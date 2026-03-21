import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      throw new Error(`Authentication error: ${claimsError?.message ?? "Invalid token"}`);
    }

    const userId = claimsData.claims.sub;
    const userEmail = typeof claimsData.claims.email === "string" ? claimsData.claims.email : null;
    if (!userEmail) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId, email: userEmail });

    const { data: userRow } = await adminClient
      .from("users")
      .select("plus_active, plus_provider")
      .eq("user_id", userId)
      .single();

    const plusProvider = userRow?.plus_provider;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      if (!plusProvider || plusProvider === "stripe") {
        await adminClient
          .from("users")
          .update({ plus_active: false })
          .eq("user_id", userId);
      }
      return new Response(JSON.stringify({ subscribed: userRow?.plus_active ?? false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      const endTimestamp = subscription.current_period_end;
      if (endTimestamp) {
        const endMs = typeof endTimestamp === 'number' && endTimestamp < 1e12
          ? endTimestamp * 1000
          : endTimestamp;
        subscriptionEnd = new Date(endMs).toISOString();
      }
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });

      await adminClient
        .from("users")
        .update({
          plus_active: true,
          plus_activated_at: new Date().toISOString(),
          plus_provider: "stripe",
          plus_expires_at: subscriptionEnd,
        })
        .eq("user_id", userId);
    } else {
      logStep("No active subscription found");
      if (!plusProvider || plusProvider === "stripe") {
        await adminClient
          .from("users")
          .update({ plus_active: false })
          .eq("user_id", userId);
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    const isAuthError = errorMessage.includes("Authentication error") || errorMessage.includes("No authorization");
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isAuthError ? 401 : 500,
    });
  }
});
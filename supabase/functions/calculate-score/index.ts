import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { area_id, date } = await req.json();
    if (!area_id || !date) {
      return new Response(JSON.stringify({ error: "Missing area_id or date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify area belongs to user
    const { data: area } = await admin
      .from("areas")
      .select("id, user_id")
      .eq("id", area_id)
      .single();

    if (!area || area.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Area not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if today was completed
    const { data: checkin } = await admin
      .from("checkins")
      .select("completed")
      .eq("area_id", area_id)
      .eq("date", date)
      .single();

    const completed = checkin?.completed ?? false;

    // Get yesterday's score record to compute cumulative
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: yesterdayScore } = await admin
      .from("score_daily")
      .select("cumulative_score, consecutive_missed")
      .eq("area_id", area_id)
      .eq("date", yesterdayStr)
      .single();

    const prevCumulative = yesterdayScore?.cumulative_score ?? 0;
    const prevMissed = yesterdayScore?.consecutive_missed ?? 0;

    let dailyScore: number;
    let consecutiveMissed: number;

    if (completed) {
      dailyScore = 1.0;
      consecutiveMissed = 0;
    } else {
      // Not completed — compute based on consecutive missed
      consecutiveMissed = prevMissed + 1;
      if (consecutiveMissed === 1) {
        dailyScore = 0.0;
      } else if (consecutiveMissed === 2) {
        dailyScore = -0.5;
      } else {
        dailyScore = -1.0;
      }
    }

    const cumulativeScore = prevCumulative + dailyScore;

    // Upsert score_daily
    const { error: upsertError } = await admin
      .from("score_daily")
      .upsert(
        {
          area_id,
          date,
          daily_score: dailyScore,
          cumulative_score: cumulativeScore,
          consecutive_missed: consecutiveMissed,
        },
        { onConflict: "area_id,date", ignoreDuplicates: false }
      );

    if (upsertError) {
      // If unique constraint doesn't exist on (area_id, date), try insert then update
      const { data: existing } = await admin
        .from("score_daily")
        .select("id")
        .eq("area_id", area_id)
        .eq("date", date)
        .single();

      if (existing) {
        await admin
          .from("score_daily")
          .update({
            daily_score: dailyScore,
            cumulative_score: cumulativeScore,
            consecutive_missed: consecutiveMissed,
          })
          .eq("id", existing.id);
      } else {
        await admin.from("score_daily").insert({
          area_id,
          date,
          daily_score: dailyScore,
          cumulative_score: cumulativeScore,
          consecutive_missed: consecutiveMissed,
        });
      }
    }

    return new Response(
      JSON.stringify({
        daily_score: dailyScore,
        cumulative_score: cumulativeScore,
        consecutive_missed: consecutiveMissed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

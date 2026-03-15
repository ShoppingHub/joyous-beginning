import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error || !code || !stateParam) {
      return redirectWithError('OAuth was cancelled or failed');
    }

    // Decode state
    let state: { token: string; origin: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return redirectWithError('Invalid state parameter');
    }

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return redirectWithError('Server configuration error');
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token || !tokenData.refresh_token) {
      return redirectWithError('Failed to exchange authorization code');
    }

    // Get user email from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    if (!userInfoRes.ok || !userInfo.email) {
      return redirectWithError('Failed to get Google user info');
    }

    // Verify the Supabase user from the state token
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${state.token}` } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return redirectWithError('Invalid user session');
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Upsert the token record using service role (bypasses RLS for upsert)
    const { error: dbError } = await supabaseAdmin
      .from('google_oauth_tokens')
      .upsert({
        user_id: user.id,
        google_email: userInfo.email,
        refresh_token: tokenData.refresh_token,
        access_token: tokenData.access_token,
        access_token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        status: 'active',
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.error('DB error:', dbError);
      return redirectWithError('Failed to save connection');
    }

    // Redirect back to the app settings page with success
    const origin = state.origin || '';
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/settings?google_connected=true` },
    });
  } catch (error) {
    console.error('Callback error:', error);
    return redirectWithError('Unexpected error');
  }
});

function redirectWithError(msg: string) {
  // Try to redirect to app, fallback to simple error
  return new Response(`
    <html><body>
      <p>Error: ${msg}</p>
      <p><a href="/">Return to app</a></p>
    </body></html>
  `, {
    status: 400,
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * pull-google-tasks Edge Function
 *
 * Reverse sync: checks completed tasks in Google Tasks "opad.me" TaskList
 * and creates corresponding check-ins in the app.
 *
 * AUTH: Bearer JWT
 * INPUT: POST (no body needed)
 * OUTPUT: { synced: number, errors: string[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TASKS_API = "https://tasks.googleapis.com/tasks/v1";
const MARKER_RE = /\[opad:([a-f0-9-]+):(\d{4}-\d{2}-\d{2})\]/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Get Google tokens ---
    const { data: tokenRow } = await supabaseAdmin
      .from("google_oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!tokenRow) {
      return jsonResponse({ synced: 0, errors: [], skipped: "no_google" });
    }

    // Refresh token if expired
    let accessToken = tokenRow.access_token;
    const expiresAt = new Date(tokenRow.access_token_expires_at).getTime();
    if (Date.now() > expiresAt - 60_000) {
      const refreshed = await refreshGoogleToken(tokenRow.refresh_token);
      if (!refreshed) {
        await supabaseAdmin
          .from("google_oauth_tokens")
          .update({ status: "auth_error" })
          .eq("user_id", userId);
        return jsonResponse({ synced: 0, errors: ["token_expired"] });
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin
        .from("google_oauth_tokens")
        .update({
          access_token: refreshed.access_token,
          access_token_expires_at: new Date(
            Date.now() + (refreshed.expires_in || 3600) * 1000
          ).toISOString(),
        })
        .eq("user_id", userId);
    }

    // --- Get synced areas ---
    const { data: areas } = await supabaseAdmin
      .from("areas")
      .select("id")
      .eq("user_id", userId)
      .eq("google_tasks_sync", true)
      .eq("tracking_mode", "binary")
      .is("archived_at", null);

    if (!areas || areas.length === 0) {
      return jsonResponse({ synced: 0, errors: [] });
    }

    const syncedAreaIds = new Set(areas.map((a: any) => a.id));

    // --- Find "opad.me" TaskList ---
    const listRes = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      return jsonResponse({ synced: 0, errors: ["tasklist_fetch_failed"] });
    }
    const listData = await listRes.json();
    const taskList = (listData.items || []).find((l: any) => l.title === "opad.me");
    if (!taskList) {
      return jsonResponse({ synced: 0, errors: [] });
    }

    // --- Get completed tasks ---
    const completedTasks = await listCompletedTasks(accessToken, taskList.id);

    const errors: string[] = [];
    let synced = 0;

    for (const task of completedTasks) {
      if (!task.notes) continue;
      const match = task.notes.match(MARKER_RE);
      if (!match) continue;

      const [, areaId, dateStr] = match;
      if (!syncedAreaIds.has(areaId)) continue;

      // Upsert check-in (idempotent)
      try {
        const { error: upsertError } = await supabaseAdmin
          .from("checkins")
          .upsert(
            {
              area_id: areaId,
              user_id: userId,
              date: dateStr,
              completed: true,
            },
            { onConflict: "area_id,date" }
          );

        if (upsertError) {
          errors.push(`Checkin upsert failed for ${areaId}/${dateStr}: ${upsertError.message}`);
        } else {
          synced++;
        }
      } catch (e) {
        errors.push(`Checkin error for ${areaId}/${dateStr}: ${e}`);
      }
    }

    return jsonResponse({ synced, errors });
  } catch (error) {
    console.error("pull-google-tasks error:", error);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});

// --- Helpers ---

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshGoogleToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("Token refresh failed:", await res.text());
    return null;
  }
  return await res.json();
}

async function listCompletedTasks(
  accessToken: string,
  taskListId: string
): Promise<any[]> {
  const tasks: any[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      maxResults: "100",
      showCompleted: "true",
      showHidden: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `${GOOGLE_TASKS_API}/lists/${taskListId}/tasks?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      console.error("List tasks failed:", await res.text());
      break;
    }

    const data = await res.json();
    if (data.items) {
      // Only completed tasks
      tasks.push(...data.items.filter((t: any) => t.status === "completed"));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return tasks;
}

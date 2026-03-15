/**
 * sync-google-tasks Edge Function
 *
 * CONTRACT:
 * - Auth: Bearer JWT (Supabase user token)
 * - Input (POST JSON): { area_id?: string }
 *   - If area_id provided: sync only that area
 *   - If omitted: sync all areas with google_tasks_sync=true
 * - Output: { synced: number, errors: string[] }
 *
 * LOGIC:
 * 1. Get user's Google OAuth tokens (refresh if expired)
 * 2. Get/create "opad.me" TaskList
 * 3. For each synced area, create tasks for current + next week
 *    based on frequency distribution pattern
 * 4. Skip tasks that already exist (matched by marker in notes)
 *
 * FREQUENCY → DAY DISTRIBUTION:
 * 1x: [Mon]  2x: [Mon,Thu]  3x: [Mon,Wed,Fri]
 * 4x: [Mon,Tue,Thu,Fri]  5x: [Mon-Fri]  6x: [Mon-Sat]  7x: [Mon-Sun]
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Frequency → ISO day-of-week (1=Mon … 7=Sun)
const FREQ_DAYS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

const GOOGLE_TASKS_API = "https://tasks.googleapis.com/tasks/v1";

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

    // --- Parse body ---
    let areaIdFilter: string | null = null;
    try {
      const body = await req.json();
      areaIdFilter = body?.area_id ?? null;
    } catch {
      // no body is fine
    }

    // --- Get Google tokens ---
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("google_oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (tokenError || !tokenRow) {
      return jsonResponse({ error: "Google not connected" }, 400);
    }

    // Refresh token if expired
    let accessToken = tokenRow.access_token;
    const expiresAt = new Date(tokenRow.access_token_expires_at).getTime();
    if (Date.now() > expiresAt - 60_000) {
      // Refresh
      const refreshed = await refreshGoogleToken(tokenRow.refresh_token);
      if (!refreshed) {
        // Mark as auth_error
        await supabaseAdmin
          .from("google_oauth_tokens")
          .update({ status: "auth_error" })
          .eq("user_id", userId);
        return jsonResponse({ error: "Google token expired, reconnect required" }, 401);
      }
      accessToken = refreshed.access_token;
      // Update in DB
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
    let areasQuery = supabaseAdmin
      .from("areas")
      .select("id, name, frequency_per_week, tracking_mode")
      .eq("user_id", userId)
      .eq("google_tasks_sync", true)
      .is("archived_at", null);

    if (areaIdFilter) {
      areasQuery = areasQuery.eq("id", areaIdFilter);
    }

    const { data: areas, error: areasError } = await areasQuery;
    if (areasError) {
      return jsonResponse({ error: "Failed to fetch areas" }, 500);
    }

    if (!areas || areas.length === 0) {
      return jsonResponse({ synced: 0, errors: [] });
    }

    // --- Get/create TaskList "opad.me" ---
    const taskListId = await getOrCreateTaskList(accessToken, "opad.me");
    if (!taskListId) {
      return jsonResponse({ error: "Failed to create Google TaskList" }, 500);
    }

    // --- Get existing tasks to avoid duplicates ---
    const existingTasks = await listAllTasks(accessToken, taskListId);

    // --- Generate and create tasks ---
    const errors: string[] = [];
    let synced = 0;
    const today = new Date();
    const dates = getTargetDates(today);

    for (const area of areas) {
      // Only sync binary tracking areas
      if (area.tracking_mode !== "binary") continue;

      const freq = Math.min(Math.max(area.frequency_per_week, 1), 7);
      const scheduledDays = FREQ_DAYS[freq] || FREQ_DAYS[7];

      for (const date of dates) {
        const isoDow = date.getDay() === 0 ? 7 : date.getDay(); // Convert JS Sunday=0 to ISO 7
        if (!scheduledDays.includes(isoDow)) continue;

        const dateStr = formatDate(date);
        const marker = `[opad:${area.id}:${dateStr}]`;

        // Check if task already exists
        const exists = existingTasks.some(
          (t: any) => t.notes && t.notes.includes(marker)
        );
        if (exists) continue;

        // Create task
        try {
          const res = await fetch(
            `${GOOGLE_TASKS_API}/lists/${taskListId}/tasks`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: area.name,
                notes: marker,
                due: `${dateStr}T00:00:00.000Z`,
              }),
            }
          );

          if (res.ok) {
            synced++;
          } else {
            const errBody = await res.text();
            errors.push(`Task create failed for ${area.name} on ${dateStr}: ${errBody}`);
          }
        } catch (e) {
          errors.push(`Task create error for ${area.name} on ${dateStr}: ${e}`);
        }
      }
    }

    // --- Get existing checkins to sync completion status ---
    const startDate = formatDate(dates[0]);
    const endDate = formatDate(dates[dates.length - 1]);
    const areaIds = areas.filter(a => a.tracking_mode === "binary").map(a => a.id);

    if (areaIds.length > 0) {
      const { data: checkins } = await supabaseAdmin
        .from("checkins")
        .select("area_id, date, completed")
        .eq("user_id", userId)
        .in("area_id", areaIds)
        .gte("date", startDate)
        .lte("date", endDate);

      // Re-fetch tasks after creation to include newly created ones
      const allTasks = await listAllTasks(accessToken, taskListId);

      if (checkins && checkins.length > 0) {
        for (const checkin of checkins) {
          if (!checkin.completed) continue;
          const marker = `[opad:${checkin.area_id}:${checkin.date}]`;
          const task = allTasks.find(
            (t: any) => t.notes && t.notes.includes(marker)
          );
          if (task && task.status !== "completed") {
            try {
              const res = await fetch(
                `${GOOGLE_TASKS_API}/lists/${taskListId}/tasks/${task.id}`,
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ status: "completed" }),
                }
              );
              if (!res.ok) {
                const errBody = await res.text();
                errors.push(`Complete task failed: ${errBody}`);
              }
            } catch (e) {
              errors.push(`Complete task error: ${e}`);
            }
          }
        }
      }
    }

    return jsonResponse({ synced, errors });
  } catch (error) {
    console.error("sync-google-tasks error:", error);
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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns dates for current week (Mon-Sun) + next week (Mon-Sun) */
function getTargetDates(today: Date): Date[] {
  const dates: Date[] = [];
  const dow = today.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);

  // 14 days: this week + next week
  for (let i = 0; i < 14; i++) {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() + i);
    dates.push(d);
  }
  return dates;
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

async function getOrCreateTaskList(
  accessToken: string,
  name: string
): Promise<string | null> {
  // List existing
  const listRes = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    console.error("List tasklists failed:", await listRes.text());
    return null;
  }

  const listData = await listRes.json();
  const existing = (listData.items || []).find(
    (l: any) => l.title === name
  );
  if (existing) return existing.id;

  // Create
  const createRes = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: name }),
  });

  if (!createRes.ok) {
    console.error("Create tasklist failed:", await createRes.text());
    return null;
  }

  const created = await createRes.json();
  return created.id;
}

async function listAllTasks(
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
    if (data.items) tasks.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return tasks;
}

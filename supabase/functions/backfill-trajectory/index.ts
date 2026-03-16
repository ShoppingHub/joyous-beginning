import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALPHA = 0.08;

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

    // Get all areas for this user
    const { data: areas, error: areasError } = await admin
      .from("areas")
      .select("id")
      .eq("user_id", user.id);

    if (areasError || !areas?.length) {
      return new Response(JSON.stringify({ message: "No areas found", updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalUpdated = 0;

    for (const area of areas) {
      // Get all score_daily for this area ordered by date
      const { data: scores } = await admin
        .from("score_daily")
        .select("id, date, daily_score, consecutive_missed")
        .eq("area_id", area.id)
        .order("date", { ascending: true });

      if (!scores?.length) continue;

      // Also get checkins to recalculate daily_score properly
      const { data: checkins } = await admin
        .from("checkins")
        .select("date, completed")
        .eq("area_id", area.id);

      const checkinMap = new Map<string, boolean>();
      if (checkins) {
        for (const c of checkins) {
          checkinMap.set(c.date, c.completed);
        }
      }

      // Recalculate trajectory_state sequentially
      let prevTrajectory = 0;
      let prevConsecutiveMissed = 0;

      for (const score of scores) {
        const completed = checkinMap.get(score.date) ?? false;

        let dailyScore: number;
        let consecutiveMissed: number;

        if (completed) {
          dailyScore = 1.0;
          consecutiveMissed = 0;
        } else {
          consecutiveMissed = prevConsecutiveMissed + 1;
          if (consecutiveMissed === 1) {
            dailyScore = 0.0;
          } else if (consecutiveMissed === 2) {
            dailyScore = -0.5;
          } else {
            dailyScore = -1.0;
          }
        }

        const trajectoryState = prevTrajectory + ALPHA * (dailyScore - prevTrajectory);

        await admin
          .from("score_daily")
          .update({
            daily_score: dailyScore,
            consecutive_missed: consecutiveMissed,
            trajectory_state: trajectoryState,
          })
          .eq("id", score.id);

        prevTrajectory = trajectoryState;
        prevConsecutiveMissed = consecutiveMissed;
        totalUpdated++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Backfill complete", updated: totalUpdated }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error", details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

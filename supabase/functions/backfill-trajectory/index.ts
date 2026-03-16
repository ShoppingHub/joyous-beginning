import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALPHA = 0.08;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get ALL areas across all users
    const { data: areas, error: areasError } = await admin
      .from("areas")
      .select("id, user_id");

    if (areasError || !areas?.length) {
      return new Response(JSON.stringify({ message: "No areas found", updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalUpdated = 0;
    const usersProcessed = new Set<string>();

    for (const area of areas) {
      usersProcessed.add(area.user_id);

      const { data: scores } = await admin
        .from("score_daily")
        .select("id, date, daily_score, consecutive_missed")
        .eq("area_id", area.id)
        .order("date", { ascending: true });

      if (!scores?.length) continue;

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
      JSON.stringify({
        message: "Backfill complete",
        updated: totalUpdated,
        users: usersProcessed.size,
        areas: areas.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error", details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

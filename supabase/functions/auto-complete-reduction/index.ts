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

    // Get today's date from request body (client sends their local date) or fallback to UTC
    let body: any = {};
    try { body = await req.json(); } catch {}
    const todayStr = body.today || new Date().toISOString().split("T")[0];

    // Fetch user's active reduction areas
    const { data: reductionAreas, error: areasError } = await admin
      .from("areas")
      .select("id, baseline_initial, created_at")
      .eq("user_id", user.id)
      .eq("tracking_mode", "quantity_reduce")
      .is("archived_at", null);

    if (areasError) throw areasError;
    if (!reductionAreas || reductionAreas.length === 0) {
      return new Response(JSON.stringify({ message: "No reduction areas", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const area of reductionAreas) {
      const baseline = area.baseline_initial ?? 0;

      // Find the last score_daily entry for this area to know where to start
      const { data: lastScore } = await admin
        .from("score_daily")
        .select("date")
        .eq("area_id", area.id)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      // Start from the day after last scored, or area creation date
      const areaCreatedDate = area.created_at.split("T")[0];
      const startDate = lastScore
        ? nextDay(lastScore.date)
        : areaCreatedDate;

      // Process each missing day up to yesterday (today is still in progress)
      const yesterday = prevDay(todayStr);
      let currentDate = startDate;

      while (currentDate <= yesterday) {
        // Get quantity for this day
        const { data: qRow } = await admin
          .from("habit_quantity_daily")
          .select("quantity")
          .eq("area_id", area.id)
          .eq("date", currentDate)
          .single();

        const quantity = qRow?.quantity ?? 0;
        const completed = quantity < baseline;

        // Upsert checkin
        await admin.from("checkins").upsert(
          {
            area_id: area.id,
            user_id: user.id,
            date: currentDate,
            completed,
          },
          { onConflict: "area_id,date" }
        );

        // Get previous day's score
        const prev = prevDay(currentDate);
        const { data: prevScore } = await admin
          .from("score_daily")
          .select("cumulative_score, consecutive_missed, trajectory_state")
          .eq("area_id", area.id)
          .eq("date", prev)
          .single();

        const prevCumulative = prevScore?.cumulative_score ?? 0;
        const prevMissed = prevScore?.consecutive_missed ?? 0;
        const prevTrajectory = prevScore?.trajectory_state ?? 0;

        let dailyScore: number;
        let consecutiveMissed: number;

        if (completed) {
          dailyScore = 1.0;
          consecutiveMissed = 0;
        } else {
          consecutiveMissed = prevMissed + 1;
          if (consecutiveMissed === 1) dailyScore = 0.0;
          else if (consecutiveMissed === 2) dailyScore = -0.5;
          else dailyScore = -1.0;
        }

        const cumulativeScore = prevCumulative + dailyScore;
        const trajectoryState = prevTrajectory + ALPHA * (dailyScore - prevTrajectory);

        await admin.from("score_daily").upsert(
          {
            area_id: area.id,
            date: currentDate,
            daily_score: dailyScore,
            cumulative_score: cumulativeScore,
            consecutive_missed: consecutiveMissed,
            trajectory_state: trajectoryState,
          },
          { onConflict: "area_id,date", ignoreDuplicates: false }
        );

        processed++;
        currentDate = nextDay(currentDate);
      }
    }

    return new Response(
      JSON.stringify({ message: "Auto-complete reduction done", processed }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

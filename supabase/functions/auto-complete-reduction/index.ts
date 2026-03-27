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

    // Get today's date in Rome timezone
    const now = new Date();
    const romeDateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
    
    // Yesterday in Rome time (this is the day that just ended)
    const yesterday = new Date(romeDateStr);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Fetch all active reduction areas
    const { data: reductionAreas, error: areasError } = await admin
      .from("areas")
      .select("id, user_id, baseline_initial")
      .eq("tracking_mode", "quantity_reduce")
      .is("archived_at", null);

    if (areasError) throw areasError;
    if (!reductionAreas || reductionAreas.length === 0) {
      return new Response(JSON.stringify({ message: "No reduction areas found", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let autoCompleted = 0;
    let missed = 0;

    for (const area of reductionAreas) {
      const baseline = area.baseline_initial ?? 0;

      // Get yesterday's quantity
      const { data: quantityRow } = await admin
        .from("habit_quantity_daily")
        .select("quantity")
        .eq("area_id", area.id)
        .eq("date", yesterdayStr)
        .single();

      const quantity = quantityRow?.quantity ?? 0;
      const completed = quantity < baseline;

      // Upsert checkin for yesterday
      await admin.from("checkins").upsert(
        {
          area_id: area.id,
          user_id: area.user_id,
          date: yesterdayStr,
          completed,
        },
        { onConflict: "area_id,date" }
      );

      // Calculate score for yesterday
      const dayBeforeStr = new Date(
        yesterday.getTime() - 86400000
      ).toISOString().split("T")[0];

      const { data: prevScore } = await admin
        .from("score_daily")
        .select("cumulative_score, consecutive_missed, trajectory_state")
        .eq("area_id", area.id)
        .eq("date", dayBeforeStr)
        .single();

      const prevCumulative = prevScore?.cumulative_score ?? 0;
      const prevMissed = prevScore?.consecutive_missed ?? 0;
      const prevTrajectory = prevScore?.trajectory_state ?? 0;

      let dailyScore: number;
      let consecutiveMissed: number;

      if (completed) {
        dailyScore = 1.0;
        consecutiveMissed = 0;
        autoCompleted++;
      } else {
        consecutiveMissed = prevMissed + 1;
        if (consecutiveMissed === 1) dailyScore = 0.0;
        else if (consecutiveMissed === 2) dailyScore = -0.5;
        else dailyScore = -1.0;
        missed++;
      }

      const cumulativeScore = prevCumulative + dailyScore;
      const trajectoryState = prevTrajectory + ALPHA * (dailyScore - prevTrajectory);

      await admin.from("score_daily").upsert(
        {
          area_id: area.id,
          date: yesterdayStr,
          daily_score: dailyScore,
          cumulative_score: cumulativeScore,
          consecutive_missed: consecutiveMissed,
          trajectory_state: trajectoryState,
        },
        { onConflict: "area_id,date", ignoreDuplicates: false }
      );

      processed++;
    }

    return new Response(
      JSON.stringify({
        message: "Auto-complete reduction done",
        date: yesterdayStr,
        processed,
        autoCompleted,
        missed,
      }),
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

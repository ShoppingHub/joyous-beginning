import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;

    // Check if user already has areas (prevent double seeding)
    const { data: existingAreas } = await supabase.from("areas").select("id").eq("user_id", userId).limit(1);
    if (existingAreas && existingAreas.length > 0) {
      return new Response(JSON.stringify({ message: "User already has data" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create 4 areas
    const areasDefs = [
      { name: "Morning run", type: "health", frequency_per_week: 5 },
      { name: "Read 30 min", type: "study", frequency_per_week: 7 },
      { name: "No social after 9pm", type: "reduce", frequency_per_week: 7 },
      { name: "Track expenses", type: "finance", frequency_per_week: 3 },
    ];

    const { data: insertedAreas, error: areasError } = await supabase
      .from("areas")
      .insert(areasDefs.map((a) => ({ ...a, user_id: userId })))
      .select();

    if (areasError || !insertedAreas) {
      return new Response(JSON.stringify({ error: "Failed to create areas", details: areasError }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate 365 days of checkins and scores
    const today = new Date();
    const checkins: any[] = [];
    const scores: any[] = [];

    for (const area of insertedAreas) {
      const freq = areasDefs.find((a) => a.name === area.name)!.frequency_per_week;
      let cumulativeScore = 0;
      let consecutiveMissed = 0;

      for (let dayOffset = 364; dayOffset >= 0; dayOffset--) {
        const d = new Date(today);
        d.setDate(d.getDate() - dayOffset);
        const dateStr = d.toISOString().split("T")[0];

        // Simulate realistic behavior: higher adherence recently, some streaks/misses
        const weekNum = Math.floor(dayOffset / 7);
        const dayOfWeek = d.getDay();
        
        // Base probability from frequency
        let prob = freq / 7;
        
        // Add some variation: worse in early months, improving over time
        const progressFactor = 1 - (dayOffset / 365) * 0.3; // 0.7 → 1.0 over the year
        prob *= progressFactor;
        
        // Weekend effect for some areas
        if (area.type === "health" && (dayOfWeek === 0 || dayOfWeek === 6)) {
          prob *= 0.6;
        }
        
        // Add streaks: if completed yesterday, more likely today
        if (checkins.length > 0) {
          const lastCheckin = checkins[checkins.length - 1];
          if (lastCheckin.area_id === area.id && lastCheckin.completed) {
            prob = Math.min(prob * 1.2, 0.95);
          }
        }

        // Random noise
        const completed = Math.random() < prob;

        checkins.push({
          area_id: area.id,
          user_id: userId,
          date: dateStr,
          completed,
        });

        // Calculate score
        let dailyScore: number;
        if (completed) {
          consecutiveMissed = 0;
          dailyScore = 1;
        } else {
          consecutiveMissed++;
          dailyScore = -1 * (1 + consecutiveMissed * 0.5);
        }
        
        cumulativeScore += dailyScore;

        scores.push({
          area_id: area.id,
          date: dateStr,
          daily_score: dailyScore,
          cumulative_score: cumulativeScore,
          consecutive_missed: consecutiveMissed,
        });
      }
    }

    // Batch insert checkins (in chunks of 500)
    for (let i = 0; i < checkins.length; i += 500) {
      const chunk = checkins.slice(i, i + 500);
      const { error: checkinsError } = await supabase.from("checkins").insert(chunk);
      if (checkinsError) {
        console.error("Checkins insert error:", checkinsError);
      }
    }

    // Batch insert scores (in chunks of 500)
    for (let i = 0; i < scores.length; i += 500) {
      const chunk = scores.slice(i, i + 500);
      const { error: scoresError } = await supabase.from("score_daily").insert(chunk);
      if (scoresError) {
        console.error("Scores insert error:", scoresError);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Seed complete",
        areas: insertedAreas.length,
        checkins: checkins.length,
        scores: scores.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

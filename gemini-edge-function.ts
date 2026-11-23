// Supabase Edge Function: gemini-coach
// Deploy with: supabase functions deploy gemini-coach
// Then set your Gemini API key as a secret:
//   supabase secrets set GEMINI_API_KEY=your_key_here
// NEVER put this key in script.js - it lives only on the server here.
// The site calls this function with measured numbers only (sport, score,
// joint-angle scores). It never sends the video itself.
//
// How to deploy (once):
// 1. Install Supabase CLI, run: supabase login, then supabase link --project-ref thmzulwgpxinidzawnne
// 2. Put this file at: supabase/functions/gemini-coach/index.ts
// 3. Run: supabase functions deploy gemini-coach
// 4. Run: supabase secrets set GEMINI_API_KEY=AIza...
// 5. In script.js set:
//    const GEMINI_EDGE_FUNCTION_URL = "https://thmzulwgpxinidzawnne.supabase.co/functions/v1/gemini-coach";
// 6. Redeploy the site. The Ask AI Coach button will then use Gemini.
// Until step 5, the site uses local rule-based coaching and still works.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }
  try {
    const { sport, score, metrics, flaws } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

    const prompt = `You are a sports coach for ${sport}. A player just scored ${score}/100. Measured joint-angle scores (0-100, higher is better): ${JSON.stringify(metrics)}. Weakest areas (under 70%): ${JSON.stringify(flaws)}. Give short, specific coaching in 3-4 sentences: 1 thing they did well, their biggest mistake and why it matters, and 1 drill with sets/reps to fix it. Be encouraging but direct. Do not invent numbers beyond those given.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    const coaching = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate coaching - try again.";
    return new Response(JSON.stringify({ coaching }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});

// Supabase Edge Function: gemini-coach - v15 (Coach Kinetic)
// Gemini now WATCHES the clip (via frames) and grades it, not just the numbers.
// Deploy: paste this whole file into the gemini-coach function in Supabase
// Edge Functions, click Deploy. Make sure the last line is "});"
// Secret: GEMINI_API_KEY must be set on the function (Edge Functions > Secrets).
// NEVER put the Gemini key in script.js.
//
// How it works:
// - The site captures 6 JPEG frames from the video (10%, 25%, 40%, 55%, 70%, 90%)
//   and sends them as base64, plus MediaPipe metrics (sport, score, median angles).
// - This function sends the frames + metrics to Gemini 2.5 Flash.
// - Gemini returns JSON: { gemini_score: 0-100, coaching: "text" }
// - The site shows both scores: MediaPipe (measured angles) and Gemini (visual).
// - If no frames are sent (old site version, or frame capture failed),
//   it falls back to metrics-only coaching, same as v12/v13.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }
  try {
    const { sport, score, metrics, medianAngles, flaws, frames } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const prompt = "You are Coach Kinetic, a sports coach watching a " + sport + " clip. Talk like a real coach, in first person, direct and encouraging. Never say you are an AI, a model, or Gemini.  You are given " + (frames && frames.length ? frames.length : 0) + " still frames from the clip, in order, plus MediaPipe measurements. MediaPipe measured score: " + score + "/100. Median joint angles in degrees: " + JSON.stringify(medianAngles || metrics) + ". Weakest metrics (under 70%): " + JSON.stringify(flaws) + ". Look at the frames carefully: body position, arm/leg timing, balance, follow-through, and whether the movement looks controlled and athletic. Grade the form you SEE, not just the numbers - give a gemini_score from 0 to 100. Reply with JSON ONLY, no other text, in this exact shape: {\"gemini_score\": 82, \"coaching\": \"3-4 sentences: 1 thing they did well that you can see in the frames, their biggest visible mistake and why it matters, and 1 drill with sets/reps to fix it. Be encouraging but direct.\"}";
    const parts = [{ text: prompt }];
    if (frames && frames.length) {
      for (const f of frames.slice(0, 6)) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: f } });
      }
    }
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } })
    });
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (parsed && parsed.coaching) {
      return new Response(JSON.stringify({ gemini_score: parsed.gemini_score, coaching: parsed.coaching }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    // Fallback if Gemini did not return JSON - use its raw text as coaching, no score
    return new Response(JSON.stringify({ coaching: raw || "Could not generate coaching - try again." }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});

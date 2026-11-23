# KineticAI — v12: full Gemini coaching

v12 is v11 plus one fix: the site now sends your Supabase anon key when it
calls the Gemini Edge Function, so Supabase accepts the call. Without that
header the function would reject it and you would only ever get local coaching.

## Step 1 - Get a free Gemini API key (5 minutes)
1. Go to https://aistudio.google.com - sign in with Google.
2. Click **Get API key** (top left) > **Create API key** > create in a new project.
3. Copy the key. It starts with `AIza...`
   Free tier, no credit card. This is for Gemini 2.5 Flash.
   DO NOT paste this key in chat, and DO NOT put it in script.js.

## Step 2 - Deploy the Edge Function in Supabase (no CLI needed)
1. In Supabase dashboard, go to **Edge Functions** (left sidebar).
2. Click **Create a new function**, name it exactly: `gemini-coach`
3. Delete the sample code in the editor, paste in the whole contents of
   `gemini-edge-function.ts` from this zip, click **Deploy**.
4. After it deploys, click on the `gemini-coach` function, go to
   **Secrets** (or Environment Variables, depending on the dashboard),
   add a new secret:
   - Name: `GEMINI_API_KEY`
   - Value: paste your full `AIza...` key from Step 1
   - Save.
   The key now lives only on Supabase's server. The site never sees it.

   If you use the Supabase CLI instead, the equivalent is:
   `supabase functions deploy gemini-coach`
   `supabase secrets set GEMINI_API_KEY=AIza...`
   And set `verify_jwt = false` for this function in config.toml, or the
   site's anon-key header (already in v12) is what authorises the call.

## Step 3 - Point the site at the function
In v12 script.js, set this one line (near the top, with the Supabase URL):
```js
const GEMINI_EDGE_FUNCTION_URL = "https://thmzulwgpxinidzawnne.supabase.co/functions/v1/gemini-coach";
```
Leave your SUPABASE_URL and SUPABASE_ANON_KEY as they are (lines 8-9).

## Step 4 - Deploy v12 and test
1. Run this SQL once (if you have not already, from v11):
   `alter table public.sessions add column if not exists coaching_text text;`
2. Replace all 3 files on GitHub with the v12 files.
3. Push, wait for Pages, hard refresh / incognito.
4. Sign in, upload an .mp4, grade it, click **Ask AI Coach**.
   - If Gemini is connected, you will get a short, specific coaching
     message written by Gemini from your measured scores.
   - If it still shows "(Local coaching...)" at the end, Gemini did not
     connect - check: Edge Function deployed? Secret set? URL set in
     script.js exactly as above? Then try again.

## What Gemini receives
Only measured numbers: sport, overall score, joint-angle scores, and the
names of the weak metrics. It never receives the video file, and it never
receives your Gemini key (that is only in the Edge Function secret).

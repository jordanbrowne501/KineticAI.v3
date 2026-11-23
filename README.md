# KineticAI — v5: storage meter removed

## Why the site said storage was used
That number was fake, from the original code:
- Basketball: 2.4 / 5.0 GB
- Volleyball: 3.8 / 5.0 GB
- Boxing: 1.2 / 5.0 GB

It changed per sport, even though nothing was ever uploaded to the cloud. Uploads in this site are local only (URL.createObjectURL) — no video is stored in Supabase Storage yet, so real usage is 0.

The live site you were looking at was still running the old version with those fake numbers.

## What v5 does
- Removed the Cloud Storage meter from the header in index.html entirely.
- Removed the storage-text / storage-bar code from script.js.
- Nothing on the site can now claim storage is used.

## When to add it back
Only add a storage meter back when real Supabase Storage is wired up, and have it read the logged-in user's actual usage from Supabase — never a hard-coded number.

## Deploy
Replace all three files on GitHub Pages, hard refresh / incognito. The header will no longer show a storage bar at all.

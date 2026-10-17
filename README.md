# Polar sync — setup

Polar's [AccessLink API v3](https://www.polar.com/accesslink-api/) is free and self-serve. Two pieces
are needed: a Polar API client (free) and the little Edge Function in this folder (the browser cannot
hold the client secret, and Polar's token endpoint refuses browser requests).

## 1. Create the Polar API client (2 minutes)

1. Go to <https://admin.polaraccesslink.com/> and sign in with your Polar Flow account.
2. Fill in the application details. For **redirect URI**, copy the *Redirect URI* shown in the Polar
   section of Pace Pal's import panel (`Data ▾ → Import from Strava, Garmin or Polar`) and paste it
   here — it must match character for character. No query strings or hashes.
3. Save, then copy the **client id** and **client secret**.

AccessLink apps work immediately for the account that created them.

## 2. Deploy the function (5 minutes)

1. <https://supabase.com/dashboard> → your project → **Edge Functions** → **Deploy a new function**
   → *Via Editor*. Name it exactly **`polar`**.
2. Delete the sample code, paste all of `index.ts`, press **Deploy**.
3. **Edge Functions → Secrets** → add:
   - `POLAR_CLIENT_ID`
   - `POLAR_CLIENT_SECRET`

   Save; the function restarts with them.

<details>
<summary>Command line instead</summary>

```sh
supabase login
supabase link --project-ref uqbntxuajwghnlycytid
supabase functions deploy polar
supabase secrets set POLAR_CLIENT_ID=... POLAR_CLIENT_SECRET=...
```

</details>

## 3. Connect in Pace Pal

1. Open Pace Pal over **https** (not `file://`), and publish the current `index.html` first.
2. **Data ▾ → Import from Strava, Garmin or Polar → Polar sync (free) → Connect Polar**.
3. Approve on Polar's screen. You land back in Pace Pal, which registers the app with Polar and
   imports your exercises straight away.
4. **Sync Polar** afterwards pulls new sessions.

## What comes across

Start time, duration, distance, average heart rate and sport (running, cycling, walking, hiking,
swimming, other). Polar exercises have no name, so each one is titled with its sport.

## If something goes wrong

| What you see | What it means |
|---|---|
| *Polar sync is not set up on this app yet* | The function is not deployed, or is not named exactly `polar`. |
| *Polar is not configured: set POLAR_CLIENT_ID…* | Secrets missing or misspelled. Re-add them, wait a few seconds. |
| *Polar needs you to accept its data-sharing consents…* | Accept them at <https://account.polar.com>, then connect again. |
| *Polar rejected this connection* | The token was revoked or belongs to another client. Disconnect, then connect again. |
| *That Polar sign-in could not be verified* | You came back in a different browser/tab, or storage was cleared. Connect again. |

## Note

This integration was written against Polar's published API but has not been run against a live Polar
account. If anything fails, the message in the panel names the step, and the function's logs
(Supabase → Edge Functions → polar → Logs) show what Polar answered.

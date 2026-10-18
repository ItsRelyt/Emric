# Pace Pal — AI running coach

A single-file, retro-pixel web app that logs your runs, builds a training plan around how you
actually feel, and explains every session in plain language. Everything lives in one static
`index.html` — no build step, no bundler, no framework.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

It works offline-first with `localStorage`; signing in only turns on cross-device sync.

## Features

- **Coach dashboard** — today's session with target pace, duration, distance, the "why" behind it,
  and a fallback if you feel worse than expected.
- **Training plans** — generates weekly (or until-goal-date) plans from your goal, available days
  per week, preferred long-run day, and units (km/mi). Plans roll forward automatically and are
  checked against safety rules.
- **Ask your coach** — free-text chat about your plan or how you feel. The coach can propose plan
  changes; you decide whether to apply them.
- **Activity log & stats** — personal bests (3K/5K/10K, longest run, biggest week), monthly/yearly/
  all-time totals, active weeks, plan adherence, estimated 5K trend, and a weekly recap.
- **Data in / out** — import CSV or JSON, import from Strava or Garmin exports, sync with Polar,
  export CSV or JSON, clear the log.
- **Sync & accounts** — email/password sign-in syncs workouts, deletions, coach plans, chat, profile,
  look, goals, filters, and daily check-ins across devices. Offline edits are kept locally and pushed
  on reconnect.
- **Looks** — pixel-art theme (default) or a minimal black-and-white "clean" theme, plus a
  customisable coach sprite (hat and outfit, or "Surprise me").
- **Responsive & accessible** — adapts to phone/tablet/desktop, touch vs. mouse, portrait/landscape,
  honours data-saver mode, keyboard-friendly inputs, ARIA labels and live regions throughout.

## How it is wired

| Piece | Where |
| --- | --- |
| App (HTML + CSS + JS) | `index.html` (everything) |
| Auth, database, realtime | Supabase (`@supabase/supabase-js` from CDN) |
| Tables used | `pacepal_user_data`, `app_settings` |
| Chat + coach generation | Groq OpenAI-compatible chat completions API |
| Polar OAuth/exchange | Supabase Edge Function at `supabase/functions/polar` |

The Supabase URL/anon key and the Groq endpoint/model have working defaults baked into
`index.html`. For your own deployment, change the constants near the top of the script section
(`DEFAULT_SUPABASE_URL`, `DEFAULT_SUPABASE_ANON_KEY`, `DEFAULT_URL`, `DEFAULT_MODEL`) or override
them per device through **Settings → Account & sync**.

### Setting up your own backend

1. Create a Supabase project and enable email/password auth.
2. Create the tables `pacepal_user_data (user_id, data, updated_at)` and `app_settings`, each with
   row-level security policies scoped to the signed-in user.
3. Enable a realtime channel on `pacepal_user_data` so devices pick up remote changes.
4. Deploy an Edge Function named `polar` for Polar AccessLink token exchange and exercise fetching —
   without it, Polar sync reports that it is not set up yet.
5. Supply a Groq API key (via the account settings) to enable the AI coach and chat.

Without a backend the app still runs fully in local-only mode; the sign-in button simply stays unused.

## Notes

- Bests and pace estimates are scaled from nearby distances, so treat them as approximations.
- All personal data stays in your own browser and your own Supabase project.

## Recent changes

- Removed the pace graph from the progress view. The average-pace summary text and everything else
  are unchanged.

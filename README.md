# Emric — AI running coach

A completely free AI running coach logs your runs, builds a training plan around how you
actually feel, and explains every session in plain language. Everything lives in one static
`index.html` — no build step, no bundler, no framework.

## Run it

itsrelyt.github.io/Emric/

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
  
## Notes

- Bests and pace estimates are scaled from nearby distances, so treat them as approximations.
- All personal data stays in your own browser and your own Supabase project.

## Recent changes

- **Progressive plan generator** — long plans no longer plateau at a flat weekly mileage. Volume now
  grows about 4–8% per build week (smaller step for longer blocks so improvement keeps coming across
  the whole plan instead of hitting its cap after a month), with cutback weeks every fourth week, a
  peak that scales to the length of the training block rather than distance caps alone, gradual long-run
  growth toward a distance-specific limit, then sharpen (goal-pace work) and taper phases ending on the
  goal day itself.
- **Mobile menu fix** — tapping the hamburger (three-lines) button on phones no longer dims the screen
  or leaves the three menu options unresponsive. The menu sheet is portalled to `<body>` when opened,
  with a dedicated fixed-position dim overlay sitting behind it, so ancestor stacking contexts can't
  trap the menu or intercept its taps.
- Removed the pace graph from the progress view. The average-pace summary text and everything else
  are unchanged.

## reviews

What caught my attention was building explainable running plans from goals, available days, imported activities, and daily feelings, then proposing user-approved adjustments and tracking adherence, records, and fitness trends. -anna
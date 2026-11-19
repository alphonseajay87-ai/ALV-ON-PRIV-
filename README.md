# ALVéON PRIVÉ
*L'excellence est personnelle.* — your private luxury fitness & wellness web app.

Static, installable PWA. No build step, no backend. Your data lives on your device (localStorage).

## Put it online with GitHub Pages
1. Create a new GitHub repository (private or public) and upload **everything in this folder** (keep the folder structure).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → Save.
3. After a minute your app is live at `https://<your-username>.github.io/<repo-name>/`.
4. On iPhone: open the link in **Safari → Share → Add to Home Screen**. On Android: Chrome → Install app.

## Gemini AI
Open the app → gear icon → **Gemini AI** → paste your API key → *Test connection*.
- The key is stored only in this browser/device and sent only to Google's Gemini API. **Never commit it to GitHub.**
- If your key console lets you restrict it to your `github.io` address, do it.
- Default model is `gemini-2.5-flash`. If Google renames it, change the *Model* field in Settings (the app also falls back to `gemini-flash-latest`).

What the AI does: analyses meal photos into calories/macros · chats as your coach with your real data · rebuilds your weekly plan around what you want to improve (you approve before it applies).

## Reminders (Settings → Phone alerts)
A web page cannot wake a phone by itself, so ALVéON gives you three layers:
1. **Calendar alerts (recommended).** *Add to Calendar* downloads repeating events with alarms for your meal times and training days. The phone fires them itself, offline, no account. Re-add after changing times or your plan; events update instead of duplicating.
2. **Push with ntfy.** Install the free **ntfy** app, subscribe to the topic shown in the sheet, switch on *Scheduled pushes*. Each time ALVéON is open it queues the next 3 days of alerts on ntfy.sh (their maximum is 3 days, so open the app at least that often). The topic name acts as a password; messages contain only generic text.
3. **In-app.** While ALVéON is open you also get in-app alerts and live nudges such as "protein left today".

## Updating
Edit files in GitHub and bump `VERSION` in `sw.js` (e.g. `alveon-v15`). Installed copies fetch the new files in the background and show an **Update** toast; one tap reloads into the new version. Files are served network-first (4 s timeout), so a normal online visit is always fresh and offline use still works.

## Your data
- Everything is in `localStorage` under `alveon.prive.v1`, with a schema version and migrations (`store.js`), so older data upgrades in place.
- Safety nets: a rolling daily snapshot (`.bak`), a raw copy of anything unreadable (`.corrupt`, shown in a recovery notice), and a pre-import snapshot. If storage fills up, the app trims old meal photos first, then tells you to export.
- **Settings → Data:** export a backup (the API key is never included), import with *Merge* (adds what is missing) or *Replace*, see storage use, free space by removing photos.
- Imports are validated and sanitised (ids, photos, plan shape) before anything is written.

## Progress logic
Progressive overload uses double progression: hit the top of the rep range on every set and the next session suggests more weight (+1 kg dumbbells, +2.5 kg otherwise) at the low end of the range; otherwise add a rep. Strength is scored by estimated 1RM (Epley), personal bests are detected live, and muscle levels, readiness (recovering / ready / overdue) and the Physique Index come from the same history. Bodyweight shows a 7-day average and a weekly rate.

## Files
`index.html` · `css/style.css` · `sw.js` · `manifest.webmanifest` · `assets/*` · `icons/*` · `tests/smoke.py` · `tools/` (how the figure was traced from the reference art)
`js/` — `figure` (the traced vector Spartan) · `main` (router, error boundary, offline pill, update flow) · `store` (state, migrations, backup, import/export, stats) · `dates` · `progress` (overload, PRs, trends, readiness) · `ai` (Gemini client) · `logger` (offline chat-log parser) · `session` (live workout) · `history` · `quick` · `onboarding` · `musclemap` · `scan` · `reminders` · `ui` (shared components) · `v-*` (screens)

## Tests
`python3 -m http.server 8765`, then `python3 tests/smoke.py` loads every screen on a phone viewport and fails on any script error.

## Chat logging and the hidden physique scan
- Tell the coach what you did ("I did 60 pull-ups yesterday", "5x12 dips two days ago", "I weigh 78 kg") and it is added to your history on the right date, with an Undo button. Without a Gemini key a simple offline parser handles basic phrases.
- Hidden scan: on the **Body** tab press and hold the figure for about a second, or on **Today** tap the greeting three times. Choose a photo and the coach reads your build, lists what to bring up first and can rebuild your plan from it. The photo goes only to Gemini; only a small thumbnail is kept on the device.

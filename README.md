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
Edit files in GitHub, then bump `VERSION` in `sw.js` (e.g. `alveon-v2`) so installed copies refresh.

## Files
`index.html` · `css/style.css` · `js/*` (data, store, ai, musclemap, session, views) · `sw.js` · `manifest.webmanifest` · `assets/logo.png` · `icons/*`

# Working on the app from your phone

Everything after the one-time setup can be done in the **Claude app → Code tab** on your iPhone. Each task runs in a cloud session that copies the GitHub repo, makes the change and pushes a branch for you to review [source: Claude Code docs, "Get started with Claude Code in the cloud"].

## One-time setup (computer easiest, ~15 min)
1. **Create the repo:** github.com/new → a non-obvious name → **Public** → don't add a README → Create.
2. **Upload this pack:** on the empty repo page, choose "uploading an existing file", drag in **everything inside this folder** (CLAUDE.md, README.md, spec/, art/, data/), and commit to `main`.
3. **Connect Claude to GitHub:** open claude.ai/code, sign in, and follow the "Sign in with GitHub" prompt. Accept the offer to install the **Claude GitHub App** on this repo [source: same docs page].
4. **Kick off:** in the Claude app → Code, pick the repo, branch `main`, mode **Accept edits**, and paste the message from `spec/KICKOFF.md`.
5. **Turn on GitHub Pages** after the first merge: repo **Settings → Pages → Deploy from a branch → `main` / root → Save**. The site address appears on that page.

## Every change after that
1. Claude app → **Code** → New session → this repo → branch **`main`**.
2. Mode: **Accept edits** for small changes; **Plan** for bigger ones (Claude proposes first and waits for your OK).
3. Type the request (examples below) and wait. You can put the phone away; the session keeps running.
4. When it's done, tap the **+/− diff** to look over the changes, then **Create PR**.
5. Open the PR on GitHub (browser or GitHub app) and **Merge**.
6. After a minute or two, open the site. On an installed copy, close the app fully and reopen it to pick up the update [assumption: Pages publish time; the app's "update on next open" is built in phase 1].

Start a **new session from `main` for each task**, after the previous one is merged, so each starts from the latest version.

## Ready-made requests
- "Do phase 2 of spec/APP_SPEC.md §7."
- "Set the Telegram link in data/trip.json to https://t.me/+…"
- "Add this to the itinerary for Sat 21 Nov: 10:00 …; 13:00 …" (paste your plan)
- "I've uploaded art/incoming/xyz.jpg: make it the afternoon image for 21 Nov and add it to the manifest."
- "Change the late-night greetings to: …"
- "On Papa's phone the Help button is cut off at the bottom; fix it." (attach a screenshot if the app lets you)
- "Update the spec: we decided …"

## Adding your images
Upload them to `art/incoming/` on `main` using the GitHub website ("Add file → Upload files"), then ask Claude to add them as above [assumption: uploading from the phone's browser works; on a computer it certainly does].

## During the trip (15–24 Nov)
Only data changes (itinerary, images, phrases). Announcements are typed in the app's Admin screen and don't need Claude at all.

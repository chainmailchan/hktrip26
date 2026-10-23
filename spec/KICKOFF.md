# Kickoff prompt for Claude Code: Phase 1

First do the one-time setup in `spec/PHONE.md` (repo created, this pack uploaded to `main`, Claude connected to GitHub). Then start a session in the Claude app → Code tab on this repo, branch `main`, mode **Accept edits**, and paste everything below the line.

---

You're building a small installable web app (PWA) for my family's trip to Hong Kong and Shenzhen, 17–24 Nov 2026. Four users: me (Chan), my wife Belle, and my parents Mama and Papa (~70, larger text and buttons, low finger dexterity). iPhones for three of us (Mama: iPhone 14 Pro); Papa uses a Samsung Galaxy S24+ with Chrome.

**Read `CLAUDE.md`, then `spec/APP_SPEC.md`.** The spec is the source of truth. The other folders:
- `spec/wireframes/*.dc.html`: the approved screens (Concept B). They were made in a design tool and won't run on their own; read them for layout, sizes, colours and copy.
- `art/` and `art/art-manifest.json`: every image, with background colour, fit, raise and soften.
- `data/`: seed data. Keep all trip content in data files, not in code.

**This session: Phase 1 only (spec §7). It must be live on GitHub Pages by about 30 Oct.**

Build:
1. **Hosting.** The repo already exists with this pack at its root. The app is served by GitHub Pages straight from the root of `main` (I'll switch Pages on after merging your branch), so put `index.html` and the app files at the root, alongside `art/` and `data/`. Plain static site: no backend, and no build step unless it clearly helps (if you add one, the built files must still be committed at the root).
2. **PWA shell.** Manifest (`display: standalone`, icons), a service worker that pre-caches everything (screens, data, art, fonts) so it works offline, and "update on next open" so later phases reach installed phones without a reinstall. `noindex`.
3. **Self-hosted fonts:** Figtree, Barlow Condensed, Noto Sans HK (subset to the characters we use if that keeps it small). No Google CDN at runtime.
4. **Pre-trip home (F9)** from `spec/wireframes/PreTrip.dc.html`: greeting (F11, from `data/greetings.json`), date, countdown to 17 Nov, packing progress, announcement area (empty for now), "Packing list" button at the bottom, Help link top right. Halo on all text; no panels.
5. **Packing lists (F10)** from `spec/wireframes/Packing.dc.html`, read-only in this phase (ticks come in phase 2). Without setup, show a "Mama & Papa | Chan & Belle" switch so anyone can view either list.
6. **Help (F7)** from `spec/wireframes/Help.dc.html`: the Telegram button uses `data/trip.json` → `telegram_group_url` (still a placeholder), Call buttons hidden until a phone is set up, and the emergency-numbers flow with three confirmations and the moving confirm button. Tapping outside any dialog closes it.
7. **The home-screen art engine (§4.2)**, even though only the pre-trip screen uses it now: reads `art/art-manifest.json` and `data/art-schedule.json`, supports the *bottom* and *cover* fits, raise as a share of screen height, soften wash, paper and navy themes, and safe areas (§4.5). Add a hidden preview route (e.g. `?preview=evening&date=2026-11-18`) so I can check each home image on my phone before the trip.

Rules:
- Follow the spec's sizes: nothing under 17 px; primary buttons 60–64 px; words, never icon-only buttons; respect reduce-motion.
- Never stretch art. Test at all four phones' sizes: 393 × 852 (Mama, iPhone 14 Pro), 384 × 832 (Papa, Galaxy S24+), 402 × 874 (Belle, iPhone 16 Pro), 440 × 956 (Chan, iPhone 16 Pro Max).
- Keep data small (Mama and Papa have 3 GB in China): conditional requests on polls, no repeated image downloads.
- No phone numbers, tokens or booking details in the repo.
- Anything marked [assumption] or listed in spec §8: build the placeholder and tell me; don't guess.

I'm reviewing on my phone. When you finish: push your branch, then give me (1) what to do to publish it (create PR, merge, turn on Pages), (2) a 5-line test checklist for my phone, and (3) anything you need from me before phase 2 (QR setup, tokens, ticking, announcements).

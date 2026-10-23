# Project instructions for Claude Code

Family trip app (PWA) for Chan, Belle, Mama and Papa: Hong Kong and Shenzhen, 17–24 Nov 2026. Read this file every session; it is all you know until you read the spec.

## Where things are
- `spec/APP_SPEC.md`: **the source of truth**. Read the parts relevant to the task before changing anything.
- `spec/wireframes/*.dc.html`: approved screens (Concept B). Design-tool files that won't run on their own; read them for layout, sizes, colours and copy.
- `spec/KICKOFF.md`: the phase 1 brief. `spec/PHONE.md`: Chan's own guide for working from his phone.
- `art/` + `art/art-manifest.json`: every image and how it is shown. `art/incoming/`: new images Chan uploads; optimise them into `art/` and update the manifest.
- `data/`: all trip content (trip facts, itinerary, packing lists, greetings, art schedule, emergency numbers). **Trip content goes in data files, never in code.**
- The app itself is served by GitHub Pages from the root of `main`.

## How Chan works
- Chan mostly works **from the Claude app on his iPhone** in cloud sessions. Each session starts fresh, from `main`, with no memory of earlier sessions. The spec and this file are the memory.
- Chan reviews your diff, creates the PR, and merges it on GitHub. Merging to `main` publishes the site; installed phones update the next time they're opened.
- He is a careful reviewer who wants facts separated from guesses: label anything new in the spec as [stated] (Chan said it), [proposal] (your suggestion) or [assumption] (not verified).

## Rules
- Do one task per session; keep diffs small and focused.
- **If Chan decides something, update `spec/APP_SPEC.md`** (the feature section, §8 open items, §10 decisions log, §11 changelog with a new version number) in the same branch.
- If a request conflicts with the spec, say so and ask before building.
- Design rules (spec §4): no text under 17 px; primary buttons 60–64 px; words, never icon-only buttons; no panels behind text (use the halo); never stretch art; respect reduce-motion; tapping outside any dialog closes it.
- Test layouts at all four phones: 393 × 852 (Mama, iPhone 14 Pro), 384 × 832 (Papa, Galaxy S24+), 402 × 874 (Belle, iPhone 16 Pro), 440 × 956 (Chan, iPhone 16 Pro Max).
- Keep data use small (Mama and Papa have 3 GB in China): conditional requests on polls; never re-download art.
- Never commit phone numbers, tokens, booking references or passport details. (The Telegram invite link is allowed [stated].)
- **From 15 Nov to 24 Nov: data-only changes** (itinerary, announcements, images) unless Chan explicitly asks for a code change [proposal].

## End every session with a short, phone-friendly message
1. **What changed:** up to 3 bullets.
2. **How to check it:** what to open on the phone after merging (URL, and a `?preview=` link if relevant).
3. **Needs your answer:** questions, if any.
Then remind Chan: open the diff → Create PR → merge on GitHub.

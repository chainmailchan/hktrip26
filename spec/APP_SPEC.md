# Family Trip App: HK & Shenzhen, 17–24 Nov 2026
**Living build spec.** Version 0.27, 24 Oct 2026. Owner: Chan.
This file is the handoff to the Claude Code session that builds the app. It replaces v0.15 and merges in "Concept B", which Chan confirmed as the build direction on 23 Oct [stated].

**Labels:**
- **[stated]**: Chan said it.
- **[assumption]**: not yet confirmed; check before relying on it.
- **[source: …]**: checked against an external source.
- **[proposal]**: a recommendation Chan has not explicitly approved; fine to build, easy to change.
- **[carried over]**: from v0.15, not redrawn in Concept B; build it in the Concept B style.

---

## 0. Instructions for the build session
- Build only what is in scope (§2).
- Keep **code and trip data separate**. Trip facts, the itinerary, packing lists, greetings and art choices live in data files (`data/`, §6), so Chan can change them without touching code.
- **Build in phases** (§7). Phase 1 must be live by about **30 Oct**.
- Anything under **Open items** (§8) is unresolved: build with the placeholder given and ask Chan before going further.
- **This file lives in the repo at `spec/APP_SPEC.md` and is the master copy** from the first commit on. Update it in the same branch whenever Chan decides something (§10 decisions, §11 changelog).
- **Chan works from his phone** in Claude Code cloud sessions (see `CLAUDE.md` and `spec/PHONE.md`): each session starts fresh from `main`, pushes a branch, and Chan creates and merges the PR.
- **Reference material in this repo:**
  - `spec/wireframes/*.dc.html`: Concept B screens (reference for layout, sizes and colours; they rely on a design-tool runtime, so read them as HTML/CSS rather than run them).
  - `art/` with `art/art-manifest.json`: every image, with background colour, fit and soften.
  - `data/`: seed data files.

---

## 1. Context
| Item | Detail |
|---|---|
| Users | 4 people: **Chan, Belle (Chan's wife), Mama, Papa**. Mama and Papa are ~70 [stated] |
| Devices | Chan: iPhone 16 Pro Max. Belle: iPhone 16 Pro. **Mama: iPhone 14 Pro. Papa: Samsung Galaxy S24+** (Chrome) [stated] |
| Admins | Chan and Belle: write the announcement and edit packing items. **All four phones can tick packing items** [stated] |
| Messaging | The family uses **Telegram**. The app's Help screen has one button that opens a dedicated trip group [stated, 23 Oct]. Chan will create the group; the link is a placeholder until then |
| AirTag | One AirTag, carried by Mama, shared with Mama and Belle in Find My [stated]. **Not used by the app** since the lost alert was removed (23 Oct) |
| Language | English UI; greetings in Cantonese (Traditional Chinese characters) [stated]. No phrase cards [stated] |
| Mobile data | Chan and Belle: GOMO roaming, China coverage confirmed [stated]. Mama and Papa: **SIMBA seniors' plan** (as of June 2025): 5 GB in Hong Kong, 3 GB in China [stated]; Chan understands it routes through Singapore or another country so Telegram isn't blocked [stated, "if I'm not wrong"], and has used SIMBA in China himself [stated] |
| Hosting | GitHub Pages; Chan has a GitHub account [stated]. "No private data on this app" [stated] |
| Trip | Tue 17 – Tue 24 Nov 2026, Hong Kong + Shenzhen [stated]. Pre-trip phase from Sat 31 Oct [stated] |
| Itinerary | Not locked; Chan will supply it later [stated]. Build with placeholder days |
| Payments | Chan pays for everything, so **no prices** anywhere [stated] |
| Getting around | Uber in Hong Kong, DiDi in Shenzhen [stated] |
| Visas | No one needs a visa [stated] |

## 1a. Trip skeleton (confirmed facts only)
| Date | Where | Travel |
|---|---|---|
| Tue 17 – Thu 19 Nov | Hong Kong, at **The Stellar** [stated] | Arrive on SQ882 [stated]. Scheduled arrival 12:40 at HKG T1 per Trip.com's October timetable, which lists the departure as 08:40, not 08:25 [source: Trip.com flight status]; re-check on 10 Nov |
| **Fri 20 Nov** | Move to Shenzhen [stated] | **High-speed rail from Hong Kong West Kowloon to Futian** [stated] |
| Fri 20 – Mon 23 Nov | Shenzhen, at **The Mercury Garden** [stated] | — |
| **Tue 24 Nov** | Fly home on **SQ883 at 15:10** from Hong Kong International Airport [stated] | **Ferry from Shekou straight to the airport** [stated] |
| Day-by-day plans | Not yet planned [stated] | — |

[assumption: check-out of The Stellar on 20 Nov and of The Mercury Garden on 24 Nov (3 + 4 nights); confirm against the bookings (Q28).]

**Hotels**
| | The Stellar (HK) | The Mercury Garden (SZ) |
|---|---|---|
| Full name | The Stellar, 星寓 [source: Trip.com listing] | The Mercury Garden Shenzhen Nanshan, A Tribute Portfolio Hotel (Marriott) [source: Marriott.com] |
| Address | 68 Chun Yeung Street, North Point, Hong Kong Island [source: Sonder and Trip.com listings] | 13 Keji Road, Nanshan District, Shenzhen 518057 [source: Marriott.com] |
| Check-in / out | From 15:00 / before 11:00 [source: Trip.com listing] | 15:00 / 12:00 [source: Marriott.com; Expedia lists a noon check-in, so it conflicts] |
| Nearby | North Point MTR ~430 m; Fortress Hill MTR ~540 m [source: Trip.com] | Hi-Tech Park metro ~2 min walk; MixC ~12–15 min walk [source: Expedia] |

**Crossing 1: high-speed rail, West Kowloon → Futian (Fri 20 Nov)**
- Futian is about 14 min from West Kowloon [source: WanderInChina 2026 guide]. Getting off at Futian [stated].
- Hong Kong exit and Mainland entry are both done at West Kowloon before boarding [source: WanderInChina].
- Arrive at least 45 min early at busy times; tickets are real-name, via 12306 or Trip.com [source: WanderInChina].

**Crossing 2: ferry, Shekou → Hong Kong Airport SkyPier (Tue 24 Nov)**
- Shekou Cruise Home Port to SkyPier, about 30–40 min; daily sailings roughly 07:15–20:15 [source: Trip.com HK guide, 27 Aug 2026].
- Needs a same-day flight from HKIA on a participating airline; arrive at the port 60–90 min before sailing [sources: Trip.com guide; HKIA "Ferry transfer" page].
- **Singapore Airlines takes part at Shekou** (upstream check-in: baggage, boarding pass, departure-tax refund at the port; arrive at SkyPier at least 80 min before departure; hand baggage max 9" × 14" × 22"; extra baggage bought online ≥6 h before) [source: Singapore Airlines, "Sea-to-air Transfer Ferry Service"].
- ⚠ **Status conflict:** HKIA shows notices that the ferry is "temporarily unavailable" [source: HKIA, 21 Oct 2026] and Direct Ferries shows no sailings [source: Direct Ferries], while the Aug 2026 Trip.com guide says it runs daily. **Chan to confirm (Q27)**; a check is scheduled for 10 Nov.
- Working back from SQ883 at 15:10 [assumption: arithmetic from the sourced rules]: at SkyPier by 13:50 → ferry leaves Shekou by ~13:10 → at the port ~11:40–12:10. Hotel check-out is 12:00; hotel → Shekou time not yet researched.

---

## 2. Scope [stated]
**Three jobs** (reduced from four on 23 Oct, when in-app statuses were removed [stated]):

| Job | Features |
|---|---|
| **1. Announcements** | F1 Announcement on every home screen |
| **2. Tour guide** | F2 Home · F3 Schedule · F4 Place card · F5 Weather and what to wear · F6 Hotel info |
| **3. Help** | F7 Help screen: Telegram group, calls, emergency numbers |

Plus the **pre-trip phase** [stated]: F9 countdown home and F10 packing lists, from 31 Oct to 16 Nov.
Admin tools: F8.

**Principles**
- Supports the trip without distracting from it [stated]. Open it, get the answer, put the phone away.
- Truly minimal and calm; the line art is the main source of joy [stated].
- Large text and large buttons for users around 70 with reduced finger dexterity [stated].
- Works offline once installed [proposal, carried over].

**Out of scope:** status buttons, family status line, Family screen, lost alert [stated, 23 Oct]; chat inside the app; prices [stated]; stamps [stated]; phrase cards [stated]; polls; push notifications; GPS tracking; currency tools; taxi cards or ride booking [stated].

---

## 3. Screens and features
Wireframe file names are in brackets. All screens: 390 × 844 reference, no scrolling where possible [stated].

### F1. Announcement [stated]
- On every home screen, **always at the top**, under the weather [stated: "the announcement always on top"]. Separated by a thin rule; label "Announcement · from Chan" (or Belle), then the message (≤100 characters, 19 px semibold).
- Silent: no sound, vibration or notification [stated]. Refreshes every 30 s (§5.3).
- Hidden when empty.
- Public like everything else (§5.6): no private details.

### F2. Home screen [stated] (`Main`, `Sunset`, `Night`, `Flight`)
Top to bottom:
1. **Greeting** at the top left in Chinese characters (F11); long phrases wrap onto two lines after the full-width punctuation. **Help** as a small text link at the top right, in red (#A8382C; light coral #F4A28C on navy screens).
2. **Date and place** (or time), display font.
3. **Weather plus what to wear** (F5): two lines.
4. **Announcement** (F1).
5. **Art** as the full background (§4.2).
6. **Plan button, always at the bottom** [stated]: "Today's plan" / "Tonight's plan" / "Tomorrow's plan" (late night). Opens F3 on the right day. Nothing below it.
- Admin phones: a small "Admin" text link next to Help [proposal] (F8).

### F3. Schedule [stated + proposal] (`Schedule`)
- Large stacked day names (Tuesday … Tuesday) with "17 · Hong Kong"-style meta on the right. Tap a day to open it; one open at a time; today opens by default.
- An open day shows its stops (time + name) and a final **"Tonight"** row with the hotel name [stated], which opens F6.
- Tapping a stop opens F4.
- Placeholder days show "Plans coming soon" until the itinerary is entered (data only, no code change).
- The current stop is highlighted by clock time [proposal]; there is no "Now/Next" admin control in Concept B (Q31).

### F4. Place card [stated] (`Place`)
- Background: **Chan's Hong Kong street map** (paper style by default; navy available), zoomed ~160% and softened 30%, framed on the area of the place [proposal: per-place focus point in data]. A dotted line and a pin are drawn over it, **for mood only** [stated].
- Card at the bottom: small line-art drawing of the food or activity, name, time and distance, one line on why we're going, and **"More about this place"**.
- "More about this place" opens the detail view [carried over from v0.15 F4]: About | Getting there switch, 2–4 short lines, numbered plain-language steps, and one **"Open in maps"** button (Google Maps in HK; Amap or Apple Maps in Shenzhen, §5.2). No prices.
- Shenzhen places need their own map image (Q34); until then use the paper colour with the pin only [proposal].

### F5. Weather and what to wear [stated: keep] [carried over]
- Today's forecast for the city we're in (tomorrow's after 22:00); one plain line of advice from simple rules ("Light layers. Bring the umbrella.").
- Free API with no key [assumption: Open-Meteo, or Hong Kong Observatory open data; builder to check terms and reachability]. Cache the last forecast.

### F6. Hotel info [stated: "store hotel information just in case"] [carried over]
- Opened from the "Tonight" row in F3. Name, address, check-in/out, "Open in maps". No phone button, no booking references [stated].

### F7. Help [stated, 23 Oct] (`Help`)
1. **"Lost? Stay where you are."** Then: "message the family, or call Chan. We will come to you."
2. **"Message the family on Telegram"** (the one filled button), opening the trip group's invite link from `data/trip.json` → `telegram_group_url` (placeholder for now) [assumption: an invite link opens the group in the Telegram app on iPhone and Android; test on the phones].
3. One line: "Need a toilet, a rest, or want us to wait? Just say so in the group."
4. **Call buttons**: Mama and Papa see Call Chan · Call Belle; admins see the other three. Numbers live on the phone only (§5.5).
5. **Emergency numbers**: a quiet underlined link at the bottom → dialog listing the current city's numbers (HK **999** [source: Discover Hong Kong]; SZ **110** police, **120** ambulance, **119** fire [source: National Health Commission of the PRC]). Then **three confirmations** [stated]: "Call 999?" → "Is this an emergency?" → "Last step: tap the red button to call 999." The large easy target is always **"No, go back"**; the confirm button moves below → above → beside so repeated tapping can't get through. The last button is a real `tel:` link [assumption: iPhone and Android each add their own confirmation; verify].
  - "Yes" sits at the left and the red button at the right, so a quick second tap never lands on the next confirm (the wireframe's full-width "Yes" overlapped the red button) [proposal].
  - Outside the trip dates (e.g. pre-trip, in Singapore) the dialog lists both cities' numbers [proposal].
- **Every dialog closes when you tap outside it** [stated].
- Telegram in Shenzhen depends on roaming data (§5.2); calling is the fallback.

### F8. Admin (Chan and Belle) [carried over, simplified]
- **Write the announcement**: text box (100 characters), "Show to everyone", "Clear", preview. After saving: "Done. Everyone sees this within 30 seconds."
- **Packing items**: phase 1 edits `data/packing.json` in the repo (Chan or Claude Code) [proposal]; an in-app item editor only if Chan asks.
- Not drawn in Concept B; build it in the same paper style as Packing.

### F9. Pre-trip home [stated] (`PreTrip`)
- From **Sat 31 Oct** until the morning of 17 Nov; switches to trip mode automatically [proposal].
- Greeting, "Saturday 31 October · Singapore", **"17 days to Hong Kong"**, the viewer's packing progress, announcement, **"Packing list"** button at the bottom, and a second line with the other list's progress (admins) [wireframe].
- Art: placeholder suitcase line art until Chan supplies a drawing.
- Before a phone is set up, the first progress line is Mama & Papa's list and the second Chan & Belle's [proposal]. "Singapore" and the city names come from `data/trip.json` (`home_city`, `cities`).

### F10. Packing lists [stated] (`Packing`)
- **Two lists**: Chan & Belle (full) and Mama & Papa (essentials only) [stated]. Seed items in `data/packing.json`.
- Admin phones switch between both lists with two tabs; Mama's and Papa's phones show only theirs. Before a phone is set up (view-only link), show both tabs, since the app doesn't yet know who is looking [proposal].
- Groups open one at a time; each item is a large checkbox row with an optional note.
- **All four phones can tick** [stated, 23 Oct]; ticks sync through the live-data repo (§5.3). Only Chan and Belle change the items [stated].
- **Pack by Sat 14 Nov** [stated].
- Phase 1 is read-only: the boxes are drawn but can't be ticked, with the line "You can tick things off after Chan sets up your phone." [proposal]. On phones not yet set up the tabs read "Mama & Papa | Chan & Belle", Mama & Papa first [stated: kickoff].
- Sourced notes inside the items: Singapore Airlines power banks from 15 Apr 2026: at most 2 per person, cabin bag only, ≤100 Wh without approval, no use or charging onboard [source: Singapore Airlines advisory]. Mainland China uses plug types A, C and I; Hong Kong uses Type G like Singapore [source: Trip.com China plug guide].

### F11. Greetings [stated]
- A random phrase from the pool for the current window [stated]. **Phrases are Chan's own (24 Oct)** [stated]; window times are proposals. Data: `data/greetings.json`.

| When | Phrases [stated] |
|---|---|
| Pre-trip (24 Oct – 16 Nov, all day) [stated, 24 Oct] | 執咗行李未呀？ · 護照帶咗未呀？ |
| Flight out, 17 Nov (until 14:00) | 出發啦！ |
| Flight home, 24 Nov (from 12:00) | 返屋企啦 |
| Morning 05:00–11:30 | 早晨！瞓醒未呀？ |
| Lunch 11:30–13:30 (mealtimes) | 肚餓未呀？ · 減肥聽日先 |
| Afternoon 13:30–17:30 | 三點三，飲下午茶！ · 行到腳軟 · 慢慢嚟，唔使急 |
| Evening 17:30–22:00 (evening + mealtimes) | 今晚食乜餸？ · 收工！返酒店啦 · 好撚攰 · 好撚飽 · 肚餓未呀？ · 減肥聽日先 |
| Late night 22:00–05:00 | 冲涼未呀？ · 做咩唔瞓覺？ · 瞓啦，聽日仲要行 |

- Size: 54 px for up to 3 characters, 44 px otherwise; phrases longer than one line wrap after ，！ or ？ [proposal].

---

## 4. Design

### 4.1 Direction [stated]
- Truly minimal, soft palettes, soft text. **Art is the full background; text sits above it with no panels** [stated: "I initially wanted no background panel"].
- Readability comes from a **halo**: a soft text shadow in the background colour (`0 0 2px, 0 0 6px, 0 0 12px`), plus a **soften wash** over the art (a full-screen layer of the background colour at the soften %).
- **Words, not icons** [stated pet peeve]: no icon-only buttons anywhere.
- One filled button per screen; others outlined pills (1.5 px ink border).
- Motion: gentle and minimal [stated]; the art fades/rises in on open. **All motion stops when reduce-motion is on.**

### 4.2 Art [stated]
Full table in `art/art-manifest.json`. Summary:

| Image | When | Fit | Background | Raise | Soften |
|---|---|---|---|---|---|
| Hong Kong morning | 05:00–12:00 | bottom | #F7EAD1 | 0 | 30% [stated, 24 Oct] |
| **Afternoon: one image per day** [stated, 24 Oct] | 12:00–17:30 | per image | per image | per image | 30% (paper) [stated, 24 Oct] |
| **Two sunset drawings** (`home-sunset-skyline`, `home-sunset-waterfront`; moodier versions) [stated, 24 Oct], taking turns day by day [stated: "taking turns is ok"] | 17:30–22:00 | cover | #F0DBB9 / #F3E1C3 | — | 30% [stated, 24 Oct] |
| Moonlit harbour | **22:00–05:00** [stated, 24 Oct] | cover | #022761 | — | 15% [stated, 24 Oct] |
| Victoria Harbour | afternoon candidate [stated, 24 Oct] (late night until 24 Oct) | bottom | #F1E6D0 | 14.2% of screen height | 30% [stated, 24 Oct] |
| Flight (plane over clouds) | flight mornings | cover | #18264F | — | 15% [stated, 24 Oct] |
| Victoria Peak / Shenzhen city | likely afternoon images for their days [assumption]; days TBD | bottom | see manifest | −1.2% / 13.0% | 30% [stated, 24 Oct] |
| Two Kowloon drawings (`day-kowloon-courtyard`, `day-kowloon-towers`) | afternoons of the days spent mostly in Kowloon [stated, 24 Oct]; days TBD; a day can list both to take turns | cover (~5% trimmed each side) | #E1D8CA / #EAE0CA (paper tone) | — | 30% [stated, 24 Oct] |
| Repulse Bay | **archived** in `art/archive/`, not downloaded by phones; "we are not going there" [stated, 24 Oct] | bottom | #F3E9D3 | 16.6% | 30% [stated, 24 Oct] |
| HK street map (paper / navy) | Place screen | map | #F6EAD0 / #1E4880 | — | 30% |

- Time windows and the flight-day overrides are proposals in `data/art-schedule.json`; the image–context pairings are [stated].
- **Afternoon art changes with each day's itinerary** [stated]: Chan will supply one image per day (`afternoon_by_day`). Until a day has one, the morning image stays up.
- A time slot can list several images; they take turns, one per day [proposal] (used for the two sunsets).
- **Fits:** *bottom* = full width, height in proportion, pinned to the bottom and raised by the stored share of screen height; the background colour fills the sky above. *cover* = scaled to cover without distortion, trimmed equally from both sides. **Never stretch.**
- **Two themes:**
  - *paper*: ink text #22211F, secondary #5F5A4E, ink button with paper-coloured text, Help #A8382C.
  - *navy*: cream text #F4ECDC, secondary #C9CFE0, cream button with navy text, Help #F4A28C.
- Art format for new images: **9 : 19.5 portrait** [stated, 24 Oct], 1320 × 2868 px, JPEG ~80%, <700 KB; keep the top ~40% and bottom ~15% calm and the outer ~8% each side free of anything important. 1320 × 2868 is the 16 Pro Max screen in pixels; the other three phones are the same shape within 0.3%, so a full-height drawing fills each with about 1 px trimmed. The clock sits over the top ~7% (62 of 956 pt). Set the image's `background` to the colour along its top edge: Safari paints its status-bar band in that colour.
- **Phones keep each image forever once downloaded, so a changed image needs a new file name** [proposal].
- **Hidden preview** [stated: kickoff]: `?preview` lists every home image as a button. `?preview=evening&date=2026-11-18` shows what the home screen would show then (slots: `morning`, `afternoon`, `evening`, `late`; add `&time=18:40` for an exact time, which also tests the flight-day overrides); `?preview=day-repulse-bay` shows any image from the manifest; `?preview=pretrip&date=2026-11-05` shows the pre-trip home on that date. The preview fills the weather lines with the date, time and file name, shows an example announcement, and the bottom button is "Close preview". **In the installed app** (no address bar), five quick taps on the date line open the preview list [proposal].

### 4.3 Type [stated + proposal]
- Body: **Figtree**. Chinese: **Noto Sans HK**. Date lines and screen titles: **Barlow Condensed** (current default from the test bench; final typeface is Chan's call, Q33). Self-host all fonts (§5.2).
- Sizes: greeting 54 px (44 px for long ones); weather 20 px; announcement 19 px; labels ≥17 px; buttons 18–19 px bold. Never below 17 px.
- Self-hosted in `fonts/` (≈77 KB in all). Noto Sans HK holds only the greeting characters; after greetings change, re-run `tools/subset-noto.py` (new characters still show, in the phone's own Chinese font, until then).

### 4.4 Touch and accessibility
- Primary buttons 60–64 px tall; everything else ≥48 px (most 52–56 px). Plain taps only: no swipes, long-presses or pinches.
- Respect the phone's text-size setting; high contrast (WCAG AA minimum).
- No carousels, no timed pop-ups.

### 4.5 Screen sizes and safe areas [proposal]
- Real screens:
  - iPhone 16 Pro (Belle) 402 × 874 pt and 16 Pro Max (Chan) 440 × 956 pt, safe areas 62 pt top / 34 pt bottom [source: useyourloaf.com, "iPhone 16 Screen Sizes"].
  - iPhone 14 Pro (Mama) 393 × 852 pt [source: same page]; safe areas likely 59 / 34 like other Dynamic Island phones of that size [assumption: read them from `env()` rather than hard-coding].
  - Galaxy S24+ (Papa) 384 × 832 CSS px, device pixel ratio 2.8125 [source: blisk.io device list]; same shape as the iPhones (≈0.46).
  - All four phones are almost the same shape, so art crops and layouts look alike on each.
- Art runs edge to edge behind the status bar and, in Safari, down behind the address bar [stated, 24 Oct]. It scrolls with the page rather than being fixed, because iOS Safari doesn't draw fixed content under its bottom bar [source: Apple Developer Forums, thread 800798], so in Safari the home screen can move by the height of that bar [proposal]. Measured in Safari on Chan's 16 Pro Max: the page starts 62 pt down (the status bar band is Safari's, tinted with the page colour; Safari doesn't draw page content there at rest, so full-screen art can't touch the top in a Safari tab [assumption from Chan's screenshots]; the installed app draws it behind the clock, and iOS 26.1+ adds a dark gradient there [source: autobrr/qui issue 2520]) and ended 58 pt above the bottom edge; in an iPhone Safari tab the page is made 58 px taller so the art runs into that strip [proposal]. The installed app fills the whole screen; text starts below `env(safe-area-inset-top)` and the button sits above `env(safe-area-inset-bottom)`. In Safari the button sits above the toolbar; in the installed app, above the home bar [proposal; Chan: "okay for now", 24 Oct].
- Text sizes stay fixed; bigger phones get more space between announcement and button.
- Test on Papa's S24+ in Chrome, both in the browser and installed.

---

## 5. Technical architecture

### 5.1 Platform: installable web app (PWA) on GitHub Pages
- **Android (Papa):** Chrome → "Install app" creates a launcher icon; opens full-screen [source: web.dev "WebAPKs on Android"]. Needs a manifest with `display: standalone` and icons.
- **iPhone:** Safari → Share → Add to Home Screen.
- **GitHub Pages:** on GitHub Free the repo must be public, and the Pages site is **always public** [source: GitHub Docs]. Treat everything as public (§5.6).
- **Updates:** the installed app picks up new versions the next time it is opened online, so trip features can ship after the setup visit [assumption: implement "update on next open" in the service worker and verify on both platforms].
  - Built in phase 1 (`sw.js`): everything is served from the phone. Each time the app opens, the app and data files are re-checked with conditional requests (unchanged files return 304, no download); if anything changed, the new set is stored and shows on the next open. Art, fonts and icons download once at install (≈4.4 MB in all) and never again [proposal].

### 5.2 Mainland China network
- Google services and Telegram are blocked on mainland local networks (hotel Wi-Fi, Chinese SIMs) but generally work over **international roaming** [source: intotravelchina.com, 2026].
- GOMO confirmed for Chan and Belle [stated]. SIMBA seniors' plan for Mama and Papa: 3 GB in China, routed out of China per Chan's understanding, and tested by Chan in China [stated]. **Avoid hotel Wi-Fi in Shenzhen** for Telegram and live data.
- Keep data use small for the 3 GB allowance: use ETag / `If-None-Match` on the 30-second polls so unchanged files return 304 with no body [proposal]; never re-download art after install.
- **Offline-first:** a service worker pre-caches screens, data, art, maps and fonts at install. Everything except the announcement, packing ticks and weather must work in airplane mode.
- If live data fails: "No connection · last updated 10:42". In Shenzhen, Help can add "Turn off Wi-Fi and use mobile data" [carried over].
- **No runtime dependency on Google**: self-host fonts; no Google Maps embed; no Firebase.
- "Open in maps" in Shenzhen: Amap or Apple Maps. Mainland maps use GCJ-02 while GPS/OSM use WGS-84 (offsets of hundreds of metres); store the datum with coordinates and convert before building Amap links [assumption: verify Amap URI parameters].

### 5.3 Live data: GitHub only (no server, no bot [stated])
- **A second, small, public repo holds the live files: `hktrip26scrt`** [stated, 24 Oct], so the phones' tokens can't touch the app. Read and written through the **GitHub REST API**, polled every 30 s while the app is open and immediately on reopen. Only the changed parts update; no reload, no scroll jump [stated].
- Files:
  - `live/board.json`: the announcement (admins write).
  - `live/packing.json`: ticks for both lists (all four phones write) [stated: all can tick].
  - Removed on 23 Oct: `live/c|b|m|p.json` (statuses) and `live/plan.json` (Now/Next) [stated / proposal, Q31].
- Concurrent writes: GitHub's SHA check rejects a stale update; re-read, merge the tick, retry.
- **Tokens:** each of the four phones holds a **fine-grained personal access token** limited to the live-data repo, Contents read/write only, expiring just after the trip [source: GitHub Docs, "Managing your personal access tokens"]. Loaded by QR (§5.5), stored only on that phone, revocable if a phone is lost.
- **Rate limits:** 5,000 requests/hour per account for personal tokens [source: GitHub Docs, "Rate limits for the REST API"]; four phones polling every 30 s ≈ 480/hour. Content-creating requests: 80/minute and 500/hour [source: same]; ticks and announcements stay well under.
- Nothing alerts a phone in a pocket; urgent things go through Telegram or a call [stated].

### 5.4 Map art
- **Chan's two static Hong Kong street maps** (`art/map-hk-paper.jpg`, `art/map-hk-navy.jpg`) replace the per-stop rendered maps of v0.15 [stated]. They are mood images, not navigation [stated].
- Source of the maps is unknown; **if they derive from OpenStreetMap data, show "© OpenStreetMap contributors"** on the Place screen (Q35) [assumption].
- No live tiles; nothing to fetch at runtime.

### 5.5 Setup and access [stated: QR setup]
- No accounts. **One QR code per person** (Chan, Belle, Mama, Papa) carrying their id, their token, admin yes/no, and the family phone numbers for the Call buttons. Scanning it sets the phone up in one step; all of it stays on the phone. **The code is scanned inside the app** (a "Set up this phone" button that opens the camera), so it sets up the installed app rather than Safari [stated, 24 Oct].
- Before setup the site still works **view-only** (countdown, lists, guide), which is what Mama and Papa see from the link Chan sends around 31 Oct [stated].
- Chan sets up Mama's and Papa's phones in person, week of 2 Nov [stated]. Include a one-page install guide.

### 5.6 Privacy (public site and repo)
- Never commit phone numbers, booking references, passport details or payment details.
- **The Telegram invite link may sit in the public repo** [stated, 24 Oct].
- **After the trip**: a reminder to Chan is scheduled for **28 Nov** to reset the Telegram invite link, revoke tokens, and turn off Pages or make the repo private [stated: "a few days after the end of the trip"].
- `noindex`; a non-obvious repo/site name [proposal].
- Itinerary, announcement and packing ticks are publicly readable; Chan accepts the itinerary being public [stated].

---

## 6. Data model
Seed files are in `data/`:
- `people.json`: four people and roles.
- `trip.json`: dates, pre-trip start, pack-by date, home city and city names, Telegram link placeholder, hotels, flights.
- `itinerary.json`: eight days with placeholder stops (only travel items are real); places come with the itinerary.
- `packing.json`: the two lists (groups → items with optional notes).
- `greetings.json`: time windows and phrase pools.
- `art-schedule.json`: which home image shows when, plus flight-day overrides and day images (unassigned).
- `emergency.json`: HK and SZ numbers.
- `art/art-manifest.json`: image metadata.

```jsonc
// place (to be filled when the itinerary arrives)
{ "id": "", "city": "HK|SZ", "name": "", "about": ["", ""], "why": "", "card_art": "dimsum|noodles|dessert|charsiu|…",
  "map": { "image": "map-hk-paper.jpg", "focus": { "x": 0.47, "y": 0.60 }, "zoom": 1.6 },
  "coords": { "lat": 0, "lng": 0, "datum": "WGS84|GCJ02" },
  "travel": { "mode": "walk|mtr|taxi|train|ferry|bus", "duration_min": 0, "steps": [""] } }

// live-data repo: live/board.json (admins); "text": "" hides it
{ "text": "Meet in the lobby at 9:30.", "by": "c", "set_at": "" }

// live-data repo: live/packing.json (all four phones)
{ "cb": { "passports": { "done": true, "by": "b", "at": "" } }, "mp": { "meds": { "done": true, "by": "m", "at": "" } } }

// on-device only (localStorage, set by QR), never in the repo
{ "me": "m", "admin": false, "github_token": "<fine-grained, repo-scoped>",
  "contacts": [{ "name": "Chan", "phone": "+65…" }, { "name": "Belle", "phone": "+65…" }] }
```

---

## 7. Build phases [proposal; Chan agreed to start now, 23 Oct]
| By | Phase | Contents |
|---|---|---|
| **~30 Oct** | **1. Pre-trip, view-only** | Repo + Pages, PWA shell (manifest, service worker, icons), self-hosted fonts, home with art and halo (F2 rules), pre-trip home (F9), packing lists read-only (F10), greetings (F11), Help (F7) with placeholder link. Works in any browser without setup |
| ~31 Oct | Chan sends the link | View-only for Mama and Papa [stated] |
| **~1 Nov** | **2. Setup and sync** | QR setup (§5.5), tokens, ticking with sync via `live/packing.json`, announcement writing (F8) and display (F1) |
| Week of 2 Nov | Chan's setup visit | Install on all four phones, scan QR codes [stated] |
| **~10 Nov** | **3. Trip mode** | Schedule (F3), Place card + detail (F4), Weather (F5), Hotel (F6), trip-mode home with time-based art, offline test |
| 10 Nov | Checks | SQ882/SQ883 times and the Shekou ferry (scheduled) |
| **~14 Nov** | **4. Real data** | Itinerary and places entered as data; no code change |
| 15–24 Nov | Data-only changes | Itinerary, images, phrases; no code changes unless Chan asks [proposal] |
| 17–24 Nov | Trip | |

---

## 8. Open items (none block phase 1)
| # | Item | Status |
|---|---|---|
| Q1 | Mama's and Papa's SIMs | **Answered:** SIMBA seniors' plan, 5 GB HK / 3 GB China, routed out of China, tested by Chan [stated] |
| Q3 | Mama's and Papa's phone models | **Answered:** iPhone 14 Pro and Galaxy S24+ [stated] |
| Q27 | Shekou → SkyPier ferry running on 24 Nov | Open; check scheduled 10 Nov |
| Q28 | Hotel dates (3 + 4 nights) | Open [assumption] |
| Q30 | SQ882 / SQ883 exact times | Deferred to 10 Nov [stated] |
| Q31 | Without Now/Next, is a clock-time highlight on the Schedule enough, or does Chan want an admin "we've moved on" control? | Open [proposal: clock time] |
| Q32 | Greeting phrases | **Answered:** Chan's full list (F11) [stated]; window times are proposals |
| Q33 | Final typeface | Chan will decide later [stated] |
| Q34 | Shenzhen map image; **one afternoon image per day** (Chan to supply); are Victoria Peak, Shenzhen city and Victoria Harbour afternoon images (which days)? Kowloon drawings received, for the mostly-Kowloon days [stated, 24 Oct]: which days? Shenzhen evening drawings: Chan looking [stated, 24 Oct]. Sunsets received at ~852 px wide; slightly soft is OK [stated, 24 Oct] | Needs art / itinerary |
| Q35 | Source of the street maps (attribution) | Open |
| Q36 | Telegram group invite link | Chan to create; **OK in the public repo** [stated]; removal reminder set for 28 Nov |
| Q37 | Pre-trip art (suitcase placeholder) | Chan may supply a drawing |
| Q38 | App name and icon | Open [proposal]: "HK trip" under the icon, "HK & Shenzhen trip" in full; icon cropped from the moonlit-harbour drawing |
| Q39 | iPhone status bar: art runs behind it (§4.5), so iOS draws the clock in white, which may be faint on the cream screens | **Answered:** readable on Chan's phone; keep [stated, 24 Oct] |
| Q40 | QR setup on iPhone: an installed home-screen app keeps its storage separate from Safari [assumption], so a code scanned with the Camera app would set up Safari, not the app | **Answered:** a "Set up this phone" button inside the app scans the code with the camera [stated, 24 Oct] |
| Q41 | Phone tokens can write to the whole repo, including the app code on `main` | **Answered:** live data goes in a second, small repo; tokens limited to it [stated, 24 Oct]. Repo: `hktrip26scrt` [stated, 24 Oct] |
| Q42 | *Bottom* drawings are about 2 : 3, so the background colour fills the top third or more of the screen; "longer is probably nicer" [stated, 24 Oct] | **Answered:** no cropping ("the cropped all look worse"); keep the drawings and let them run under Safari's address bar [stated, 24 Oct] |

---

## 9. Wireframes
- **Concept B** (the build direction): claude.ai artifact "HK Trip App Concept B (line art)"; sources in `spec/wireframes/`:
  - `Main` (morning), `Sunset` (early evening), `Night` (late night), `Flight` (flight morning): home screens.
  - `Schedule`, `Place`: tour guide.
  - `PreTrip`, `Packing`: pre-trip phase.
  - `Help`: help.
  - `ImageTest`: the image test bench used to tune art (reference only; not a screen in the app).
- The earlier "HK Trip App Wireframes" artifact (v0.1–v0.7) is **superseded**.
- All names, times, weather and announcements in the wireframes are examples.

---

## 10. Decisions log
| Date | Decision |
|---|---|
| 20 Oct | PWA on GitHub Pages; admins Chan and Belle; English UI; no prices; no private data; public itinerary OK [stated] |
| 20 Oct | No helper service or bot; 30-second refresh; QR setup [stated] |
| 20 Oct | Classy and minimal; no unexplained icons; minimal motion; three confirmations for emergency calls; tap outside closes dialogs [stated] |
| 21 Oct | Hotels The Stellar and The Mercury Garden; train to Futian on 20 Nov; ferry to the airport on 24 Nov; SQ882 / SQ883; Uber/DiDi; no visas [stated] |
| 21 Oct | Concept B started as a side exploration: art as background, greetings in Chinese, schedule accordion, place card over map [stated] |
| 22 Oct | Pre-trip phase from 31 Oct, pack by 14 Nov, two packing lists [stated] |
| 22 Oct | Chan's own drawings used directly; no panels, halo instead; announcement always at top, plan button always at bottom; test-bench settings applied to all screens [stated] |
| 22–23 Oct | New flight, evening and map images; per-image heights [stated] |
| 23 Oct | **Concept B is the build direction**; start the build now with placeholder itinerary [stated] |
| 23 Oct | **No in-app statuses** (removed status buttons, status line, Family screen, lost alert). Help = Telegram group button (placeholder link), calls, emergency numbers. The 20 Oct "no Telegram links" rule is lifted for this one button [stated] |
| 23 Oct | **All four phones can tick packing items**, so all four get QR setup and a token [stated] |
| 24 Oct | Development continues from Chan's phone: Claude Code cloud sessions on the GitHub repo; repo copy of this spec is the master [stated: "continue development from my phone"] |
| 24 Oct | Soften layer lowered: cream (paper) images 30%, navy images 15% (was 50% / 20%); street maps unchanged at 30% [stated] |
| 24 Oct | Two Kowloon drawings added for the mostly-Kowloon afternoons [stated] |
| 24 Oct | Evening: Chan's two sunset drawings. Kowloon photo for the mostly-Kowloon days. Victoria Harbour is an afternoon candidate. Repulse Bay archived (not going) [stated] |
| 24 Oct | Late night uses the moonlit harbour; evening will use a sunset photo (to upload). All future art at 9 : 19.5. Current art works well full screen in the installed app. `hktrip26scrt` is public [stated] |
| 24 Oct | Live-data repo is `hktrip26scrt`. QR codes are scanned inside the app (Q40) [stated] |
| 24 Oct | No cropping of the art; it runs under Safari's address bar instead (Q42) [stated] |
| 24 Oct | Live data in a second, small repo, with the phone tokens limited to it (Q41). Packing greetings from 24 Oct until the day before the trip. iPhone clock readable with the art behind it (Q39). Button gap at the bottom okay for now [stated] |
| 24 Oct | Phones: Mama iPhone 14 Pro, Papa Galaxy S24+. SIMBA seniors' plan works in China. Telegram link OK in the public repo; reminder on 28 Nov to remove public links. **Afternoon image per day.** Greeting phrases supplied [stated] |

## 11. Changelog
- **v0.27 (24 Oct 2026):** Soften layer lowered to 30% on cream images and 15% on navy (§4.2).
- **v0.26 (24 Oct 2026):** Two Kowloon drawings added as afternoon candidates for the mostly-Kowloon days (Q34).
- **v0.25 (24 Oct 2026):** Two sunset drawings (moodier versions) for the evening, taking turns by day; Repulse Bay archived; Victoria Harbour an afternoon candidate; Kowloon photo slot noted (Q34).
- **v0.24 (24 Oct 2026):** Late night → moonlit harbour; evening slot reserved for the sunset photo (moonlit harbour meanwhile); Victoria Harbour unscheduled; 9 : 19.5 art format stated; `hktrip26scrt` public.
- **v0.23 (24 Oct 2026):** Five taps on the date line open the art preview inside the installed app; art format notes (§4.2); Safari's top band explained (§4.5).
- **v0.22 (24 Oct 2026):** In an iPhone Safari tab the art runs into the 58 pt strip below the page (§4.5); live-data repo named (Q41); in-app QR scanning (§5.5, Q40).
- **v0.21 (24 Oct 2026):** Art scrolls with the page so it runs under Safari's address bar; crop preview removed; Q42 answered.
- **v0.20 (24 Oct 2026):** Phase 1 feedback: art runs behind Safari's toolbars; crop preview (`&fit=cover`); packing greetings from 24 Oct; live data moves to a second repo (§5.3, Q41); Q39 answered; Q42 (art height) added.
- **v0.19 (24 Oct 2026):** Phase 1 built: PWA shell (manifest, icons, service worker with update on next open), self-hosted fonts, pre-trip home (F9), read-only packing lists (F10), greetings (F11), Help with the emergency flow (F7), art engine with a hidden preview (§4.2), and `tools/check.mjs` (layout check at the four phone sizes). `home_city` and `cities` added to `data/trip.json`. Build proposals noted in F7, F9, F10, §4.2, §4.3, §5.1. New open items Q38–Q41.
- **v0.18 (24 Oct 2026):** Phone workflow: repo layout (`CLAUDE.md`, `spec/`, `art/`, `data/`, app at the root of `main`), cloud-session and PR flow, repo copy of the spec is the master, data-only changes from 15 Nov.
- **v0.17 (24 Oct 2026):** Phones and SIMs answered (Q1, Q3); greeting phrases added (F11) with pre-trip and flight-day pools; afternoon art slot with one image per day; screen sizes for all four phones; data-saving note; Telegram link allowed in public repo with a 28 Nov removal reminder.
- **v0.16 (23 Oct 2026):** Concept B merged as the build direction. Scope cut to three jobs plus the pre-trip phase. Removed: family strip, statuses, Family screen, lost alert, Find My, cab request, Now/Next map panel, Days list, tabs, rendered maps. Added: art system and manifest, greetings, pre-trip home, packing lists with ticks on all phones, Help with Telegram, Chan's street maps, screen-size rules, build phases, seed data files.
- **v0.15 and earlier (20–21 Oct):** see the previous version of this file in the project history (four-job design with family strip, statuses and lost alert).

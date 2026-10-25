# Setup visit: four phones (week of 2 Nov)

One page for Chan (APP_SPEC §5.5). Each phone gets its own token and setup code. The codes hold the token and the family's phone numbers, so **never photograph, screenshot or send them**.

## Before the visit (~20 min, on your phone)
1. **Give the live-data repo a first file.** Open github.com/chainmailchan/hktrip26scrt. If it says the repository is empty, add a README (any text) and commit it. The app writes the announcement and ticks there; this rules out any trouble with an empty repo (Q44).
2. **Make four tokens, one per person.** Go to github.com → your picture → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token. For each one:
   - Name: "HK trip Mama" (then Papa, Belle, Chan).
   - Expiration: custom, **30 Nov 2026**.
   - Repository access: **Only select repositories** → `hktrip26scrt`.
   - Permissions → Repository permissions → **Contents: Read and write**. GitHub adds Metadata (read-only) itself.
   - Generate, then copy the token (it starts with `github_pat_`). GitHub shows it only once, so keep the four in a locked note until the visit.
3. **Set up your own phone.**
   - Open the trip site in Safari → Share → **Add to Home Screen**, then open it from the icon.
   - Tap the date line five times quickly → **Make setup codes**.
   - Paste the four tokens and type the four phone numbers → **Make the codes**.
   - On the **Chan** tab → **Use Chan's code on this phone** → Home.
4. **Test it.** Home now shows **Admin** under Help. Write a test announcement, check it appears, then **Clear the announcement**. Tick and untick one packing item.

## At the visit (each phone)
1. **Install the app.**
   - iPhone (Mama, Belle): Safari → the trip site → Share → **Add to Home Screen** → Add.
   - Android (Papa): Chrome → the trip site → ⋮ menu → **Install app** (or Add to Home screen).
2. **Open the app from its home-screen icon, not the browser.** On iPhone the browser and the installed app keep separate settings.
3. On that phone: **Packing → Set up this phone → Open the camera** → allow the camera.
4. On your phone: Hidden pages → **Make setup codes** (paste the tokens again if you've left the screen) → that person's tab. Hold it in front of their camera.
5. Their phone says **"This phone is set up for Mama."** → **Done**.
   - If the camera won't open: **Take a photo of the code instead** (Q43).
6. **Check:** tick one item and see it on your phone within 30 seconds, then untick it. On Help, the Call buttons show the right names (Mama and Papa: Chan and Belle).

## After the visit
- Delete the note with the tokens.
- **Lost phone:** GitHub → Fine-grained tokens → that person's token → **Revoke**. Then make a new token and code for the replacement phone.
- The 28 Nov reminder covers revoking all four tokens after the trip (§5.6).

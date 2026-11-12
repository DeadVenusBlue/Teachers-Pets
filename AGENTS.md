# My Art Pets — guidance for future sessions

Read `My_Art_Pets_Cutie_Edition.html` and `DEVELOPMENT.md` before changing this project. The original HTML is an unchanged design reference outside `public/`; never deploy it or overwrite it.

## Purpose and visual direction

My Art Pets is for Erin, an Art/Textiles teacher at Bishop Burton College, and eventually one Level 1 Art & Design class of 15–20 students aged approximately 16–18. Phone browsers are the priority; desktop and home access also matter.

Expand what Erin already has. Preserve the six original SVG pet illustrations, plum outlines, smiling faces, pastel pink/lilac/mint/yellow palette, rounded controls and kind, gentle tone. New artwork should fit that style. Avoid replacing the pets with emoji, stock art or a different visual system. The original SVGs live in `public/artwork.js`, with an automated preservation check.

## Current scope: feedback demo v0.2.0

- Plain HTML, readable separate CSS/JavaScript, no framework, runtime dependencies or backend.
- Exactly three fictional profiles: Alex, Jamie and Taylor. No real student data.
- Browser-only localStorage. Progress never syncs between devices, browsers or origins.
- Clearly label unrestricted teacher demo controls and lack of accounts/privacy.
- Stars/passes originate only in the teacher demo controls. Care and Memory Match never award stars. This is UI behaviour, not security.
- Available stars can be spent; lifetime stars never decrease. Accessories are permanent; treats are repeatable. Free care caps at 100, never decays and pets never die.
- Memory Match rounds persist per student. Preserve rounds and never consume another pass on switching. Cancel timers and check both round identity and generation before callbacks. Reset must clear all rounds as well as saved progress.
- Validate every persisted field. Keep text safe with `textContent`; artwork `innerHTML` must contain only developer-owned SVG templates and validated enum values.
- Feedback stays local and can be copied with the displayed version, including a manual fallback.
- Maintain native keyboard controls, visible focus, reduced motion and narrow-screen layouts.
- No messaging, public student profiles, multiplayer, certificates, uploads, room decoration or real accounts in this milestone.

## Project workflow

- `npm start` previews only `public/` on `http://127.0.0.1:4173`. No dependency installation is required. Use `npm.cmd` if PowerShell blocks the npm script.
- `npm test` runs Node's built-in tests. Tests cover rules, real app handlers using a simulated DOM, timer races, storage recovery, original artwork and static hosting contracts. A simulated DOM is not visual browser verification.
- For interface changes, use an available browser to check desktop and phone widths (320, 390 and 1280px), touch controls, keyboard focus, reduced motion and horizontal overflow. If browser access is unavailable, record the exact limit; never claim these checks passed.
- Keep this a buildless static project; only `public/` belongs on Hosting.
- Keep package version and `VERSION` in `public/model.js` aligned. Update `DEVELOPMENT.md` with actual checks and limitations.

## Hosting and future security

`firebase.json` serves only `public/`. The user has corrected the confirmed project to **`erins-proj-788fe`**; `.firebaserc` sets it as the default. Use this project for all future deployments. Use `firebase.cmd` in PowerShell because `firebase.ps1` is blocked. The Hosting-only command is `firebase.cmd deploy --only hosting --project erins-proj-788fe`. Do not create other cloud resources, enable billing, configure Authentication or change Firestore rules. Never broaden this command to a blanket deployment. Ask before changing to another project or destination; do not invent IDs.

`noindex` and Hosting's `X-Robots-Tag` affect search visibility only. They do not restrict access. Never use this demo for private information or describe the teacher toggle as secure.

The next implementation milestone follows Erin's feedback, then separately designs authentication, private student profiles and a staff dashboard with server-enforced awards, passes and access. Future students must never be able to award themselves stars or access other students' private information. Secure authorization belongs on the backend; hiding controls is insufficient.

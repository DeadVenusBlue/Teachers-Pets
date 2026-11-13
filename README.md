# My Art Pets · Cutie Edition

**v0.3.0 — accounts milestone, local review only.** Teachers invite students and award stars; students sign in to their own pet. Firebase Authentication provides identity and Firestore stores shared progress. The original artwork, care actions, shop, lifetime achievements and saved Memory Match rounds are retained.

The existing **v0.2.0 feedback demo remains live at https://erins-proj-788fe.web.app/**. Cal has approved publication and the production Firestore rules/indexes are deployed; Hosting awaits trusted teacher provisioning. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for the current release record. Demo fictional profiles and local browser saves are separate from this version. New accounts start fresh; demo localStorage is never imported into class records.

## Run locally on Windows

Requirements: Node.js 22+, Java 21+, Edge, and internet access for the Firebase web SDK from `www.gstatic.com`. The project stays buildless; npm packages provide local development, tests and trusted administration. Only `public/` is served.

```powershell
cd 'C:\CALLUMS DOCS\TeachersPets\Teachers-Pets'
npm.cmd ci
```

On this PC, Java 21 was downloaded into the ignored `.tools/` folder. In the terminal that will run Firebase, use:

```powershell
$env:PATH = "$PWD\.tools\jre-21\jdk-21.0.13+9-jre\bin;$env:PATH"
java -version
npm.cmd run emulators
```

On a fresh clone, install Java 21 and put its `bin` folder on PATH instead. The first emulator run may download Firebase's emulator files. No Firebase sign-in, service-account key, billing or live project setup is needed for the local workflow. Use `.cmd` launchers if PowerShell blocks `.ps1` files.

Keep that terminal running. In a second terminal in the same repository:

```powershell
npm.cmd run seed:local
```

Open **http://127.0.0.1:5000**. The emulator UI is **http://127.0.0.1:4000**. `localhost` and `127.0.0.1` always use the isolated `demo-my-art-pets` emulator project. The only real project configured for eventual release is **`erins-proj-788fe`**.

| Local fictional account | Email | Password |
| --- | --- | --- |
| Teacher Erin | `erin@example.test` | `Teacher123!` |
| Student Alex | `alex@example.test` | `Student123!` |
| Student Jamie | `jamie@example.test` | `Student123!` |

These are emulator-only credentials. The seed creates two students with zero stars and no passes. Rerunning it preserves existing progress and student removals; it does not reset passwords changed through a reset flow.

## Cal's walkthrough

1. Use a normal Edge window for Erin and an InPrivate window for Alex. For Jamie, use a separate Edge profile or another browser; two InPrivate windows share a session.
2. Sign in as Erin, select **Alex**, then tap **Attendance +3 ★**. Alex's window should show three available and three lifetime stars. Sign Alex out, sign back in and reload: the stars remain.
3. Award enough stars to buy a **Pretty bow** (10). Buy it as Alex. Available stars decrease once; lifetime stars stay intact. Change the pet, background and name, and try free care.
4. Grant a Memory Match pass as Erin. Start the game as Alex, reveal a card, reload and finish the same round. Reloading or signing out does not consume another pass; completing a game never awards stars.
5. Try **Invite a student** with a new fictional email such as `taylor@example.test`. Copy the link into a separate signed-out session. Create the invited account. The Auth emulator prints the verification link in the first terminal: open it, return to the app and click **I've verified my email**. The roster changes from invitation ready to joined.
6. Try **Forgotten your password?**. The emulator prints a reset URL with `newPassword=NEW_PASSWORD_HERE`; replace that placeholder with a chosen test password before opening it. Return and sign in with the new password. No real emails are sent by the emulator.
7. Edit a student's display name or remove their class access from Erin's roster. A removed student's pet becomes inaccessible, including after reload. The saved record is retained. Reinstatement is currently a trusted Cal/admin operation, not self-enrolment.

For an account with no assignment, use the emulator UI's Authentication tab to create a fictional email/password user and mark the email verified. Signing in shows the account-needs-linking message; it never creates a role.

Stop the emulators with Ctrl+C. The default session is disposable: restarting starts empty and requires `seed:local` again. To retain local data across emulator restarts, use this instead of the ordinary start command:

```powershell
npm.cmd run emulators -- --import=.emulator-data --export-on-exit=.emulator-data
```

The export directory is ignored by Git. A first run without an existing import starts empty. A reload or sign-out does not clear progress while the emulators are running. These loopback addresses work on this PC only; physical-phone access has not been enabled or verified.

## Checks

Stop any manually running emulators before the automated suites; the tests use the same ports and clear fictional data. Ensure Java 21 is on PATH in that terminal.

```powershell
npm.cmd test
npm.cmd run test:rules
npm.cmd run test:e2e
```

The last command launches installed Edge headlessly. Screenshots and failure traces are stored under ignored `test-results/`. `npm.cmd start` still serves only `public/` at port 4173, but sign-in needs the Auth and Firestore emulators running; port 5000 is the recommended complete preview.

See [DEVELOPMENT.md](DEVELOPMENT.md) for actual results and limitations, and [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for the later console setup, trusted teacher provisioning and explicit deployment commands. **Do not run live setup or deployment until Cal has reviewed the flows.**

## Files

- `My_Art_Pets_Cutie_Edition.html`: unchanged design reference, never hosted.
- `public/`: HTML, CSS, application/model/artwork and modular Firebase client. No privileged credentials or Admin SDK.
- `firestore.rules`: server-enforced identity, invitation, reward and spending permissions.
- `scripts/seed-local.mjs`: fictional, local-only bootstrap.
- `scripts/provision-teacher.mjs`: trusted live administration, outside the hosting root; requires separate credentials.
- `tests/`: Node regressions, direct Firestore Rules tests and Edge emulator journeys.

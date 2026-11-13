# Development handover

## Publishing progress — 13 November 2026

Cal approved replacing the old demo. Production Auth and the London Standard/free-tier Firestore database are confirmed; billing is disabled. Rules and indexes deployed successfully. The trusted script has prepared Erin's Auth account using Cal's supplied Admin credential, with private setup links saved outside the repository. Hosting is still the old demo while Erin completes email verification before staff provisioning. Details and exact commands are at the top of FIREBASE_SETUP.md.

Added `prepare:production` to package the same public app without local emulator endpoints/imports/config or development CSP connections. Its eight-file allowlist, production ID, forbidden-string checks and JavaScript syntax checks passed. Local app/game/Rules source and previously passing test results are unchanged; this packaging change has not yet had a live browser smoke test.

## Current milestone — v0.3.0, local only, 13 November 2026

This section supersedes the historical v0.2.0 status below. The old notes incorrectly said there was no successful live deployment: a read-only check confirmed the v0.2.0 demo at `https://erins-proj-788fe.web.app/`. It remains available and has not been replaced. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for the Auth/Firestore probes, unknown billing/IAM state and future console/deployment steps.

### Implementation

- Buildless HTML/CSS/JS with Firebase's modular browser SDK. Localhost always uses `demo-my-art-pets` emulators. No Functions, messaging, uploads or public profiles.
- Email/password login, verification, reset and sign-out; separate teacher/student/unlinked views. A verified invite claims one student assignment atomically. Staff membership is Admin-only. Passwords exist only in Authentication.
- Teacher roster with joined/invited/removed status, display-name changes, removal, private invitation links and one-tap award reasons. Rapid awards are queued to avoid overlapping same-session transactions. Recent activity is session-only, not a durable audit log.
- Firestore stores each pet, appearance, inventory, available/lifetime stars, passes and unfinished Memory Match round. New accounts start fresh. No demo progress import. Transactions prevent lost balances/overspending; rules enforce exact prices and immutable lifetime stars on student writes.
- Students cannot list the roster, read peer progress, mint rewards/passes or change roles. Removed members lose progress access; their own roster status remains readable to explain removal. Inactive classes deny progress and new claims.
- Memory Match server validation bounds its structure and isolates round/pass updates from rewards. Detailed deck/pair validation is in the client; game outcomes are owner-controlled and grant no stars. The rules intentionally do not prove honest gameplay. Browser timers check generation, UID and round ID; reload/sign-out preserve the round.
- Original reference and all six SVG pets are preserved. Browser progress has no persistent Firestore disk cache. Sign-out clears personal UI; Firebase handles authentication persistence separately.
- `seed:local` creates fictional emulator accounts; `provision:teacher` is a separate trusted live-admin script with credential-location/project guards. The latter has not been run against production.

### Actual checks

Environment: Windows PowerShell, Node **22.12.0**, npm **10.9.0**, repo-local Firebase CLI **15.36.0**, Java **21.0.13**, installed Edge **157** via Playwright. Java lives in ignored `.tools/`; setup commands are in README.

| Check | Result |
| --- | --- |
| Original pre-change suite | **25 passed** before this milestone's changes. |
| Current `npm.cmd test` | **23 passed, 0 failed**: model/timer/validation, source contracts, static configuration and original artwork preservation. The old localStorage/simulated-DOM handler tests were replaced for online architecture; these 23 are not the original 25. Real handlers are exercised by Edge below. |
| `npm.cmd run test:rules` | **18 passed, 0 failed, 0 skipped**. Covers verified/wrong/unverified/expired/partial/reused invitation claims, unauthorized role creation, unauthenticated/peer/roster isolation, teacher-only exact awards/passes, removal, inactive classes, care/cosmetics, forged/duplicate/concurrent purchases, lifetime invariants and Memory Match. |
| Expression-limit regression | Memory start and saved-card updates pass. Added coverage for exact 3/3/2 awards, a pass, care, all four accessories, a treat and game completion with a saved mismatch. Some deliberately rejected enrolment requests still produce expression-limit diagnostics; no allowed operation in the final suites did. |
| `npm.cmd run test:e2e` | **3 passed**, exit 0, about 1.7 minutes. Separate teacher/Alex/Jamie browser contexts exercised signup, verification, joined status, three-star live sync, sign-out/sign-in persistence, reset-code confirmation and new-password login, rapid awards to 11 stars, a bow purchase leaving 1 available/11 lifetime, reload, pet/name/colour/care persistence, display-name editing and removal. |
| Memory Match in Edge | Pass grant/use, stable keyboard card focus, one open card after reload, mismatch across sign-out/sign-in, same round ID, full completion, no reward, remaining pass and completed round after reload. Unlinked verified login also tested. |
| Layout/input | Login, dashboard and student screenshots at **320/390/1280px**, measured no horizontal overflow. Inspected saved screenshots for phone login/dashboard/student and desktop dashboard. Login Tab focus and visible outline; Memory keyboard activation/focus; touch-emulated purchase/care/appearance controls; reduced-motion pet animation disabled. |
| Local walkthrough bootstrap | **Passed** against fresh Auth/Firestore/Hosting emulators: ran `seed-local.mjs` twice, signed in all three fictional accounts, confirmed exactly two fresh zero-star profiles, fetched public assets (200), and checked original HTML, docs, config, Rules and trusted provisioning script (404). The first attempt exposed an HTTP 405 readiness probe; corrected to the Auth emulator config endpoint before the passing run. |
| Source integrity | All application/script/test JavaScript syntax checks passed; `git diff --check` passed. The original HTML matches Git after line-ending normalisation. Its Git-blob SHA-256 is the historical `0CAA…CB1` below; the Windows CRLF checkout has SHA-256 `44CB04891705F02933DBECAF9790F79DC166FC268DCC1B9CB03720956657B671`. |
| Trusted administration | Syntax checked and confirmed missing arguments fail closed (`Teacher provisioning failed: Missing --email`). Production provisioning/credential access was not exercised. |

The earlier Edge run finished with a failure at 9 rather than 11 stars; it was not hung. After operation-specific rule dispatch and serial teacher awards, the complete rerun passed without permission-denied or expression-limit messages. All test-run emulators shut down normally. Firebase CLI first encountered sandbox `EPERM` reading its user config; the approved local emulator runs succeeded with access to the existing CLI config/cache.

### Limits and release follow-up

- Headless Edge with touch emulation is not a physical phone, Safari, screen-reader audit, 200% browser zoom or a real mail-delivery test. Password reset was requested in the UI and its issued code confirmed through the Auth emulator API, followed by UI login with the new password.
- No deployment, production authentication, cloud teacher provisioning, billing change or real student account creation was performed. The original reported live phone-access error remains unverified.
- One assignment per student and one displayed class per teacher. Removal preserves data; reinstatement requires Cal. No durable award audit/undo, bulk CSV import or automatic invitation email service.
- Authentication, Firestore and browser SDK network access are required; this is not an offline-first game. A no-cost service quota can limit writes/reads. Persistent local emulator state is optional; default emulator restarts start fresh.
- `npm audit` reported **24 development-tree advisories: 19 moderate, 5 high**. The high chain comes from Node's `@grpc/grpc-js` through Firebase/rules test dependencies (GHSA-m9gg-hp2v-232j). No forced downgrade was applied. `npm audit --omit=dev` reported zero; that does not audit the separately loaded browser CDN SDK. Review toolchain advisories before production administration/release.

## Historical v0.2.0 record (superseded where stated above)

Demo **v0.2.0**, implemented and checked on **12 November 2026**.

## Completed

- Read the original before implementation and retained `My_Art_Pets_Cutie_Edition.html` unchanged outside `public/`. SHA-256: `0CAA07FC002649BED00D3D5D875AFA002D843A5F335947559B88932F19E26CB1`.
- Preserved all six original pet SVG drawings. Added matching illustrations for accessory shop items, achievement ribbons, creature buttons, Memory Match cards, the arcade, a care vignette, welcome scene and paw branding. No stock images, remote fonts or runtime dependencies.
- Separated the page, CSS, app handlers, rules/validation and artwork into readable files. Retained three fictional students, pet naming, six creatures, five background colours, free capped care, no deaths/decay, available/lifetime stars, teacher demo awards/passes, permanent accessories, repeatable treats and lifetime achievements.
- Memory Match uses one pass per new round and never awards stars. Unfinished rounds persist per student, including a face-up card or a pending mismatch. Switching away preserves the round. Returning resolves an expired mismatch. Starting another unfinished round is blocked before a pass can be spent.
- Cancelled timer handles and generation/owner/object/round-ID checks prevent stale callbacks from touching a different student or new round. Reset cancels timers, restores all three profiles and removes the active game UI as well as game data.
- Added validation for every saved field, deduplicated/allowlisted accessories, bounded history/counts/names, validated card decks and recovery from malformed/missing data. Original-format progress is imported if present on the same origin. The app remains usable with an explicit warning when storage is blocked.
- Added mobile breakpoints, wrapping layouts, 46px minimum standard button targets, native form controls, labelled progress bars, selection states, skip navigation, visible focus and reduced-motion support. Memory card elements remain stable during a round to retain keyboard focus. These measures still require the browser checks below.
- Added feedback drafts and copying with the displayed version, plus selected text for manual copying when clipboard access fails. No external feedback service or automatic submission.
- Added prominent unrestricted-demo/browser-only wording, HTML `noindex` and Hosting `X-Robots-Tag`. These affect search visibility, not access control.
- Added static `firebase.json`, `.gitignore`, project guidance, README, a local public-only server and a dependency-free regression suite. No Firebase project ID was invented.
- During the initial implementation, no deployment, billing, cloud resource creation, Authentication setup or Firestore changes were performed. Firebase CLI commands were not run at that stage. The later user-authorized Hosting release is recorded below.

## Verification actually run

Environment: Windows PowerShell, Node.js **20.18.0**, npm **10.8.2**.

| Check | Actual result |
| --- | --- |
| `npm.cmd test` | **25 tests passed, 0 failed**, using Node's built-in runner. |
| Rule tests | Passed awards/passes guarded by teacher-demo state, purchases, insufficient balances, duplicate purchase prevention, repeatable treats, care caps, lifetime invariants, validation, legacy import, names, full Memory Match completion, saved rounds and stale timer callbacks. |
| App event handlers in a simulated DOM | Passed award/shop/wardrobe/milestone flows; all six pets/five colours; rename and simulated reload; switching students during a pending mismatch; returning to a round after visiting a student with no round; game completion; cancelled/confirmed reset with stale callbacks; malformed/incomplete/blocked storage; feedback success and manual fallback. |
| Original artwork preservation | Passed a comparison of generated SVGs for all six pets against the original HTML's drawing function. Only fixed SVG width/height attributes were removed for responsive sizing. |
| Static contracts | Passed local asset references, unique IDs, label/control references, separate Hosting root, no guessed project/site ID, dependency-free package, aligned displayed/package version, `noindex`, focus and reduced-motion rules. |
| JavaScript syntax | `node --check` passed for all four application/server JS files and all three test files (seven files total). |
| Actual local HTTP preview | Started `node scripts/serve.mjs` at `http://127.0.0.1:4173`. `/`, CSS, all three JS modules and the paw SVG returned **200** with correct content types and `X-Robots-Tag`. |
| Reference/config exposure | Requests to `/My_Art_Pets_Cutie_Edition.html`, `/README.md` and `/firebase.json` returned **404** from the local server. Hosting is likewise configured with only `public/` as its root. |
| Real browser/phone/desktop rendering | **Not run.** The computer/browser tool returned `The browser access host is unavailable` and an unavailable native pipe; no browser or app surfaces could be attached. No screenshot, measured horizontal-overflow, touch, real clipboard, keyboard-navigation or reduced-motion browser pass is claimed. |
| Initial Firebase deployment/emulator | **Not run** in the initial implementation, as requested. See the later Hosting release below. |

The simulated DOM executes the real app handlers and storage/timer flows, but it is not a browser renderer or a complete DOM implementation. The HTTP checks verify real local serving, not UI layout.

The first test invocation exposed Windows/Node 20's lack of shell expansion for `tests/*.test.mjs`; the npm test script was corrected to use built-in `node --test` discovery. The final command above passed.

## Browser acceptance checks still to run

Start with `npm.cmd start`, then open the printed URL on this computer. The loopback URL does not provide access from another phone. Complete real-phone checks on an agreed hosted demo or an explicitly configured local network preview.

- At 320px and 390px viewport widths, and a desktop viewport of 1280px, inspect the header, pet choices, shop, arcade and feedback. Confirm `document.documentElement.scrollWidth <= window.innerWidth`, readable text and usable controls. Also try browser zoom at 200%.
- Use the keyboard from the skip link through student selection, teacher controls, rename, choices, care, purchases, every Memory Match card and feedback. Check visible focus, form submission with Enter and that card focus remains after a flip.
- Enable reduced motion and confirm pet bobbing and hover movement stop.
- Award enough stars to buy an accessory; check an insufficient balance, duplicate ownership, equip/put away, milestone retention and real reload persistence.
- Grant a pass, flip a mismatching pair, switch students while the 850ms timer is pending, start/play the other student's round and return. Confirm both rounds/passes are correct. Repeat with reset while a mismatch is pending, then start a fresh round.
- Complete all pairs and confirm no stars are awarded. Reload with one card open and with a mismatch pending; resume the correct student's round.
- Rename with whitespace and a long name. Confirm background/pet choices and feedback drafts survive a real reload.
- Test copy on a real phone/desktop. If clipboard permission is denied, confirm manual selection/copy includes `Demo version: 0.2.0`.

## Known limitations

- This is a fictional feedback demo, not a student pilot. All profiles and teacher controls are available to anyone using it. Local state is editable through developer tools. Future authorization must be server-enforced.
- Progress is scoped to browser, device and origin. There is no cross-device or cross-tab coordination. Simultaneous tabs can overwrite each other's saves. Clearing browser data/private sessions can discard progress. Storage errors switch to in-memory use with a visible notice.
- Corrupt game rounds are discarded during repair. No real currency or rewards are involved.
- Feedback is copied locally; the user must send it through their own preferred channel. There is no submission or collection system.
- Browser rendering/accessibility/touch checks remain outstanding because browser access was unavailable. See the Hosting release record below for publication status.
- There are no accounts, secure roles, database, messaging, uploads, certificates, room decoration or multiplayer.

## User-authorized Hosting release attempt — 12 November 2026

- The user initially supplied a different project ID, said the Firebase CLI was authenticated, and explicitly authorized a Hosting-only deployment. That project selection has since been superseded by the correction below.
- Added `.firebaserc` with that exact default project and removed it from `.gitignore` so the non-secret project selection is reviewable. Confirmed `firebase.json` still serves only `public/`, with no Authentication, Firestore, Functions or billing configuration.
- Updated README and AGENTS to use `firebase.cmd` and the confirmed project. The static Hosting test now checks the user-confirmed selection. Application behaviour and demo version remain v0.2.0.
- Re-ran the regression suite: **25 passed, 0 failed**. Application/server JavaScript syntax checks and `git diff --check` passed. Real local HTTP checks returned 200 for the page, CSS, three JS modules and paw SVG, and 404 for `.firebaserc`, `firebase.json`, the original HTML, AGENTS and DEVELOPMENT. The local preview was stopped after verification.
- Retried browser discovery. It again reported `The browser access host is unavailable` and an unavailable native pipe. Visual phone/desktop, real touch/clipboard and browser accessibility checks remain unverified.
- Verified Firebase CLI **15.36.0**. The sandbox initially blocked the global installation; the CLI was subsequently run with the tool's filesystem/network approval. The deployment command confirmed authorization as the user's stated account, `callumled@hotmail.co.uk`.
- **Deployment to the previously supplied project failed:** Firebase returned **403 PERMISSION_DENIED** from the Hosting version-creation request. The earlier permission/API checks also reported missing `serviceusage.services.use` (`USER_PROJECT_DENIED`). Project and site reads succeeded, so authentication and read access were working, but Hosting write permission on that previous project was insufficient. This result does not establish a permission issue on the corrected project.
- No version was created, no files were uploaded, and no release was published. Do not present the pre-existing site's default URL as a deployed My Art Pets demo. No Authentication, Firestore, billing or IAM changes were made.
- At that point the account needed appropriate deployment permissions on the previous project, or the user needed to confirm a different project. Firebase documents the Firebase Hosting Admin role (`roles/firebasehosting.admin`) for Hosting write access; the CLI specifically requested Service Usage Consumer (`roles/serviceusage.serviceUsageConsumer`) or equivalent `serviceusage.services.use` permission. Consult the official product-role requirements below if permission errors occur. Do not grant permissions automatically.
- The user initially replied that they would arrange access on the previous project, then superseded that project selection with the corrected ID below. Do not keep waiting for access to the previous project or reuse its deployment destination.
- Firebase's product-role documentation also specifies API Keys Viewer (`roles/serviceusage.apiKeysViewer`) for CLI deployment. The project owner should check all relevant role requirements rather than granting broad Owner/Editor access. This role requirement comes from documentation; the failed attempt specifically reported Hosting write denial and `serviceusage.services.use`.
- For future publication, use only the corrected project and Hosting-only command below, verify the successful returned URL and hosted static files/headers, then send Erin that URL. No successful deployment URL can be reported yet.

References: [Firebase product-level roles](https://firebase.google.com/docs/projects/iam/roles-predefined-product), [Hosting role permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasehosting), [Service Usage roles](https://docs.cloud.google.com/iam/docs/roles-permissions/serviceusage).

## Corrected Firebase project — 12 November 2026

- The user corrected the project ID to **`erins-proj-788fe`** and instructed that all future deployments use it.
- Updated `.firebaserc`, README, AGENTS and the static Hosting test to the corrected ID. `firebase.json` continues to serve only `public/`.
- The future deployment command is `firebase.cmd deploy --only hosting --project erins-proj-788fe`.
- Verification after the correction: `npm.cmd test` passed all **25 tests**, `git diff --check` passed, and a workspace search confirmed the previous ID is absent from project configuration, documentation and tests. Historical Firebase debug logs were excluded from that search and left untouched.
- This correction did not perform a deployment, verify cloud permissions or change Authentication, Firestore, billing or IAM. The earlier 403 errors applied to the previous destination only.

## Next milestone

1. Complete the outstanding browser acceptance checks and publish to the corrected project `erins-proj-788fe` when continuing the authorized Hosting-only deployment. Follow README's exact `firebase.cmd` command; no Authentication, Firestore or billing changes are included.
2. Send Erin the resulting demo URL and ask for copied, versioned feedback on the existing pet/art direction, phone comfort, award reasons, shop costs and game-pass flow. Progress on her phone remains separate from any other browser.
3. Make small changes from her feedback. Separately scope a later secure class pilot: individual sign-in, private student profiles, a teacher dashboard and backend-enforced awards, purchases and game permissions, with access/isolation tests. Students must never award themselves stars or see other students' private information. Do not introduce real student records until that later scope is implemented and verified.

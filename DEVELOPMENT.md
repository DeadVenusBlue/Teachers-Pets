# Development handover

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

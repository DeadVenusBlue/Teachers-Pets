# My Art Pets · Cutie Edition

A small feedback demo for Erin's Level 1 Art & Design class at Bishop Burton College. It builds on the original six pet illustrations and pastel styling. Current demo: **v0.2.0**.

**Fictional data only. Teacher demo controls are unrestricted.** Progress and feedback drafts save only in the current browser on the current device. Erin's phone and your computer have separate progress. Local preview and a hosted URL also have separate storage. No real authentication, private profiles, database, analytics or external feedback service is included.

## Local preview

Use Node.js 20 or newer (the local checks used 20.18.0). No install or build step is needed.

```powershell
cd E:\ErinsClassProj
npm.cmd start
```

Open **http://127.0.0.1:4173** in a browser. Keep the terminal running; Ctrl+C stops the server. Use HTTP rather than double-clicking `index.html`, because the JavaScript uses native modules. The preview listens only on this computer's loopback address; this URL is not a phone preview or a shareable hosted link.

```powershell
npm.cmd test
```

On shells without the PowerShell npm execution-policy issue, `npm start` and `npm test` work too.

## Try the demo

1. Choose Alex, Jamie or Taylor, then name a pet and try the six creatures and five backgrounds.
2. Feed, play and rest for free. Stats cap at 100; pets never die and stats never decay.
3. Open **Teacher demo** and award stars. Buy an accessory, equip/put it away and check the milestones. Available stars decrease; lifetime stars stay.
4. Grant a game pass and start Memory Match. Each round uses one pass. Switching students or reloading preserves unfinished rounds. Playing never awards stars.
5. Add notes under **Leave feedback**, then copy them with the demo version. If automatic copying is blocked, a selected text field is provided for manual copy. Send the copied text yourself.
6. **Reset all demo progress** clears all three profiles and rounds after confirmation, while keeping feedback notes.

## Firebase Hosting

The corrected, user-confirmed project is **`erins-proj-788fe`**. Use this project for all future deployments. `.firebaserc` sets this default, and `firebase.json` serves only `public/`. The CLI is already installed and authenticated. Use **`firebase.cmd`** for all Firebase commands because PowerShell blocks the `.ps1` launcher.

To publish an authorized update from this directory:

```powershell
npm.cmd test
firebase.cmd deploy --only hosting --project erins-proj-788fe
```

This command publishes the static demo to the confirmed project's default Hosting site. Deploy Hosting only; leave Authentication, Firestore and billing unchanged. No `firebase init`, build, Firebase SDK or backend setup is needed. Do not run a blanket deployment or replace the page with a generated welcome file.

Use the Hosting URL returned by the successful deployment. Check the demo version and critical interactions, then share the URL with Erin. Ask her to copy feedback from the page. Her progress remains on her own browser/device. See `DEVELOPMENT.md` for actual verification results and any outstanding browser checks.

**Current release status:** a deployment to the previously supplied project failed on 12 November 2026 with **403 PERMISSION_DENIED**; no demo files were uploaded or released. The user subsequently corrected the project ID to `erins-proj-788fe`. Deployment and account permissions on this corrected project have not yet been verified. The previous project's permission errors do not establish a permission issue on the corrected project. No live My Art Pets URL is available yet. Do not change IAM, Authentication, Firestore or billing as part of deployment.

The HTML robots meta tag and Hosting `X-Robots-Tag` request no indexing. **These are search visibility hints, not access control. Anyone with access to the URL can use this fictional demo and its teacher controls.**

Official instructions: [Firebase Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart), [static Hosting configuration](https://firebase.google.com/docs/hosting/full-config).

## Files

- `My_Art_Pets_Cutie_Edition.html` — unchanged original reference, outside the hosting root.
- `public/index.html`, `styles.css`, `app.js` — page, responsive styling and interaction handlers.
- `public/model.js` — validated state, pet/shop rules and game lifecycle.
- `public/artwork.js`, `public/assets/paw.svg` — original pets and matching new illustrations.
- `scripts/serve.mjs` — dependency-free local static server, restricted to `public/`.
- `tests/` — Node tests; no browser or runtime packages required.
- `AGENTS.md`, `DEVELOPMENT.md` — project guidance, verification and next milestone.

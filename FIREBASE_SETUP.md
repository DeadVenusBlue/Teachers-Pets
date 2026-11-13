# Firebase setup after Cal's review

## Publishing progress — 13 November 2026

Cal approved replacing the existing demo. CLI login as `callumled@hotmail.co.uk` can access `erins-proj-788fe`. Production Email/Password is enabled with passwords required and both Firebase Hosting domains authorized. The `(default)` Firestore database exists in `europe-west2` (London), Standard/native mode, with `freeTier: true`; the billing API returned `billingEnabled: false`.

`firebase.cmd deploy --only 'firestore:rules,firestore:indexes' --project erins-proj-788fe --non-interactive` succeeded: rules compiled and were released, and the empty required-index configuration deployed. Compiler warnings concern an unused function/parameter only. Existing passing local test results were reused; Rules were not edited.

The first teacher email supplied by Cal is `erincledsom@gmail.com`. Cal supplied an Admin SDK credential outside the repository; the trusted script validated its project and successfully ran `--prepare`. Erin's Auth account is prepared, and private password-setup/email-verification links were saved outside the repository for Cal to share. Email verification is still required before the script can grant staff membership. No password was requested in chat. Hosting has **not** been replaced yet.

The release now uses `npm.cmd run prepare:production`. This creates an ignored `.firebase/production/` package with only the eight public assets, production-only Firebase wiring and no local emulator endpoints in its CSP or JS. The command checks its file allowlist, production project, forbidden local/seed strings and JavaScript syntax. Development source and game logic are unchanged.

Once teacher provisioning is ready, the exact Hosting command is:

```powershell
npm.cmd run prepare:production
& .\node_modules\.bin\firebase.cmd deploy --config .firebase/production/firebase.json --only hosting --project erins-proj-788fe --non-interactive
```

The generated configuration serves only its `public/` subdirectory. Do not use the original development Hosting configuration for production publication.

The remaining instructions below explain setup/provisioning. The progress record above identifies which steps have now been performed. Do not run `firebase init` or a blanket `firebase deploy`.

## What was accessible on 13 November 2026

- `https://erins-proj-788fe.web.app/` returned HTTP 200. Its six checked assets matched the original v0.2.0 checkout after line-ending normalisation. This corrects the old README's claim that no live deployment existed.
- Public Hosting config identified `erins-proj-788fe`. Its public web API key/config is in `public/firebase-config.js`; it is not an admin credential.
- An invalid-input Authentication configuration probe returned `CONFIGURATION_NOT_FOUND`. A read of a nonexistent Firestore document returned `403 SERVICE_DISABLED` for `firestore.googleapis.com`.
- No signed-in Firebase CLI account was available on this PC. Those responses do **not** establish database contents, IAM permissions or the billing plan. Check the console before enabling anything. No cloud resource, account, rule, Hosting release or billing change was made.

## Enrolment and billing

The design uses email/password sign-in, email verification and Firestore Rules. It needs no Cloud Functions, custom mail server, SMS, Storage or paid extension, and can use Spark's supported services. The project's actual plan remains unconfirmed: inspect **Project settings → Usage and billing** without changing it.

Erin creates an invitation for an exact email address, atomically creating a roster row, invitation and zero-star progress. She shares the random invitation link through her usual college channel; the app does not send invitations. The student registers or signs in, verifies that address through Firebase, then claims the invitation atomically. Rules check the verified ID-token email, expiry and single-use status. Signing in alone grants no class access. Invitations expire after 30 days; remove an expired/unclaimed invitation and create another. Each account has one class assignment in this milestone.

This uses verification mail rather than passwordless email-link sign-in. Firebase lists Spark quotas of 1,000 address-verification emails/day and 150 password resets/day; normal class use fits those quotas, but quota errors remain possible. See [Authentication limits](https://firebase.google.com/docs/auth/limits). Firestore offers a free quota for one database; monitor usage because each Memory Match card action saves online. See [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).

## One-time console setup — Cal performs later

1. Open [the confirmed project](https://console.firebase.google.com/project/erins-proj-788fe/overview). Verify its ID and current plan. Do not accept a billing upgrade or switch project to work around errors.
2. Open **Authentication → Get started** if necessary, then **Sign-in method → Email/Password**. Enable **Email/Password** and Save. Leave passwordless email-link sign-in disabled. Under **Settings → Authorized domains**, confirm `erins-proj-788fe.web.app` and `erins-proj-788fe.firebaseapp.com`. Local testing uses emulators and needs no production localhost domain.
3. In **Authentication → Templates**, review the verification and password-reset sender/name/content. Keep Firebase's default action handler. Test actual delivery with Cal/Erin's test accounts after release approval; emulator checks do not prove real email delivery.
4. Open **Firestore Database → Create database**, select **Standard edition**, database ID **`(default)`**, and the location agreed with Cal/the college. Choose **Production mode**, not open test mode. Review the location before creation. If a database already exists, inspect it and its rules instead of recreating it. See [Firestore setup](https://firebase.google.com/docs/firestore/quickstart).
5. Under **Project settings → General → Your apps**, inspect the web app/config. Compare the public key, auth domain and project ID with `public/firebase-config.js`. If no web app exists, register one and copy its public config there before release; leave analytics disabled unless separately requested. Keep the emulator branch unchanged.
6. Authenticate the repo-local CLI and verify access:

   ```powershell
   & .\node_modules\.bin\firebase.cmd login
   & .\node_modules\.bin\firebase.cmd login:list
   & .\node_modules\.bin\firebase.cmd projects:list
   ```

   Use only `erins-proj-788fe`. Cal must arrange any missing IAM permissions; do not change destination or billing.

## Trusted teacher provisioning on Windows

The browser cannot create or modify `staff` records. Cal runs `scripts/provision-teacher.mjs` with Admin SDK credentials. It accepts only credentials belonging to `erins-proj-788fe`, refuses emulator variables and refuses credential files inside this repository. Passwords never go into Firestore.

In **Project settings → Service accounts → Firebase Admin SDK**, obtain a JSON key through **Generate new private key**, if permitted by the college's credential policy. Store it in a protected directory outside the repo and `public/`. Do not commit it or put it in frontend configuration. Admin credentials bypass Rules: restrict them to Cal. See [Admin SDK setup](https://firebase.google.com/docs/admin/setup).

Replace the path and email below with actual values; the sample email is deliberately fictional. Run only after approval for live account setup:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Secure\my-art-pets-admin.json'
npm.cmd run provision:teacher -- --prepare --email 'erin@example.test' --display-name 'Erin'
```

`--prepare` creates an Auth account if needed, without a password, role or class. It prints private links to set a password and verify the email. Share these only with the intended teacher through your trusted channel. The script generates links, not emails. The teacher completes both actions. See [Admin email action links](https://firebase.google.com/docs/auth/admin/email-action-links).

Then provision the verified account:

```powershell
npm.cmd run provision:teacher -- --email 'erin@example.test' --display-name 'Erin' --class-id 'level-1-art' --class-name 'Level 1 Art & Design'
Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS
```

The script rejects an unverified or disabled user, creates the class if missing and grants that UID staff membership. Repeat for future approved teachers. Teachers see their first assigned class; multi-class switching is outside this milestone. To revoke staff access, Cal can set `staff/{uid}.active` to `false` in Firestore and disable the Auth user if appropriate. Students cannot do either.

Student removal retains records and denies subsequent progress reads/writes. Clients cannot change an existing assignment. If reinstatement is needed, Cal must review and restore the intended roster status/assignment through trusted administration; do not delete an Auth user as an enrolment workaround.

## Eventual deployment — separate from local review

After Cal approves the flows and completes setup, stop local emulators and run all three suites in README. Deploy the reviewed Rules first:

```powershell
& .\node_modules\.bin\firebase.cmd deploy --only 'firestore:rules,firestore:indexes' --project erins-proj-788fe
```

`firestore.indexes.json` is empty: this app needs no composite indexes. Provision the initial teacher as above. Only when ready to replace the feedback demo, publish Hosting:

```powershell
npm.cmd run prepare:production
& .\node_modules\.bin\firebase.cmd deploy --config .firebase/production/firebase.json --only hosting --project erins-proj-788fe --non-interactive
```

Only `public/` is hosted. Record the release; check fictional accounts on two actual devices, real verification/reset emails, three-star persistence and removal before inviting real students. Neither live Auth/Firestore nor a physical phone has been verified. The old demo's reported phone-access error is not proven resolved by local Edge tests.

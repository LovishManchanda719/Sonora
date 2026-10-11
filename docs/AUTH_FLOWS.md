# Sonora sign-in methods and account linking

Every method signs the user into the **same Firebase project** (`dysarthia-detector`), so one person has one
account (one Firebase UID) no matter which method they use, as long as the methods are linked.

## 1. Ways to sign in

| Method | Website | Android app | How it works |
|---|---|---|---|
| Google | Done | Done | Web: Firebase popup. App: Google's native "Sign in with Google" sheet (Credential Manager) -> Firebase `signInWithIdp`. |
| Facebook | Done (needs console setup, see section 4) | Done (needs console setup) | Web: Firebase popup. App: opens `/auth/mobile/facebook` in the browser -> Facebook -> `sonora://auth` deep link -> Firebase `signInWithIdp`. |
| Phone (SMS OTP) | Done | Done | Descope sends and verifies the SMS (`/api/auth/otp`), then the user is signed into the Firebase account bound to that number. 100 free SMS per month. |
| Email + password | Done | Done | Firebase email/password. |
| Guest | No | Done | Local only, nothing synced. |

## 2. What a signed-in user can add on the Profile page (website)

Rows = how the user first signed in. Columns = what they can connect afterwards.

| Signed in with | + Phone | + Email & password | + Google | + Facebook |
|---|---|---|---|---|
| Phone | Change number: Done (A3) | Done (A1) | Done (A2) | Done (new) |
| Google | Done (B3) | Set password: Done (B1) | n/a | Done (new) |
| Email & password | Done (C3) | Change password: Done (C1) | Done (C2) | Done (new) |
| Facebook | Done (new, uses the same link flow) | Done if Facebook shared an email; otherwise the user enters one | Done (new) | n/a |

After linking, the user can sign in with any connected method and lands in the same account
(same history, profile and photo).

## 3. Known gaps (not implemented yet)

| Gap | Impact | Suggested fix |
|---|---|---|
| Linking from inside the Android app | App users must open the website Profile page to connect extra methods. Sign-in itself works in the app. | Add a "Connected accounts" section to the app Profile tab using the same `/api/auth/otp` and Firebase REST link calls. |
| Phone-to-email link records are stored in a JSON file on the server (`identity-links.ts`) | On Vercel this storage is temporary, so the "sign in with the email linked to my phone account" lookup (A1) can be forgotten after a redeploy or cold start. Phone sign-in itself keeps working because its credentials are derived deterministically. | Move `identity_links.json` into Firestore. |
| Same email on Google and Facebook | Firebase's default "one account per email" rule blocks a second provider with the same email at sign-in time. The app/site shows: "sign in with your original method, then connect Facebook from Profile". | Expected behaviour; linking from Profile solves it. |
| Facebook users without an email | Facebook may not share an email. The account still works; email & password linking needs the user to type an email. | Already handled by the Profile form. |
| Removing (unlinking) a method | No "Disconnect" buttons yet. | Add Firebase `unlink()` per provider, keeping at least one method. |

## 4. One-time console setup for Facebook

1. Firebase console -> Authentication -> Sign-in method -> Add new provider -> Facebook -> enable, paste the
   Meta **App ID** and **App secret**, Save.
2. Meta developer console (app "Sonora") -> Use cases / Facebook Login -> Settings -> Valid OAuth Redirect URIs, add both:
   - `https://dysarthia-detector.firebaseapp.com/__/auth/handler` (website)
   - `https://sonora-liart.vercel.app/auth/mobile/facebook` (Android app)
3. Meta -> App settings -> Basic: App domains `sonora-liart.vercel.app`, Privacy Policy URL
   `https://sonora-liart.vercel.app/privacy`, User data deletion -> instructions URL
   `https://sonora-liart.vercel.app/privacy`, Category, 1024x1024 icon.
4. While the Meta app is unpublished (development mode), only people added under App roles can sign in with Facebook.
5. Firebase -> Authentication -> Settings -> Authorized domains: make sure `sonora-liart.vercel.app` is listed.

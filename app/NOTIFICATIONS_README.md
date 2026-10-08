# Tre-X Push Notifications: Progress README

Last updated: Oct 8, 2026. Status: **PAUSED** (nothing testable yet, see "Blockers").

## For an AI reading this
Catch the user up from this file, then tell them which files to send (see "Files needed to continue"). The user wants short, direct answers, copy-paste-ready code, and surgical find-and-replace edits (not full rewrites unless asked). Do not ask "what next" after each task.

## Project context
- Tre-X (formerly CampusCart): campus marketplace, 12 Ghanaian universities.
- Backend: Node/Express/PostgreSQL on Render (`https://campuscart-tdfn.onrender.com`), routes mounted under `/api/...`.
- App: React Native + Expo SDK 57 (`expo ~57.0.24`, RN 0.86.3, Expo Router, NativeWind). `expo-dev-client` and `expo-notifications ~57.0.21` are installed. Android package: `com.sammy45.trex`. EAS projectId is in `app.json`.
- Media (avatars, chat media) is stored as **Base64 data URIs in Postgres**, not as hosted files.

## Goal
Make push notifications look like WhatsApp / Snapchat chat notifications:
- Sender's avatar is the main (left) icon.
- Tre-X app icon is a small badge at the bottom-right of the avatar.
- Title = sender name, body = message text.
- Image thumbnail on the far right when the message is a picture (with or without text).
- Both iOS and Android (their styles differ).

## How it has to work (decided)
**iOS**
- Needs a Notification Service Extension (NSE) that downloads the avatar and the image, and donates an `INSendMessageIntent` (sender name + avatar). That makes iOS show the avatar as the main icon with the app icon as the badge, plus an attachment thumbnail.
- Needs: dev/production build via EAS (not Expo Go), the Communication Notifications capability, `mutable-content: 1` on the push, and a paid Apple Developer account.
- Keeps using Expo's push API (`https://exp.host/--/api/v2/push/send`).

**Android**
- Expo's push API cannot build the avatar style. Plan: backend sends **data-only FCM messages** (via `firebase-admin`), and the app builds the notification itself with a circular avatar, small icon, title/body, and big-picture preview.
- Library: `react-native-notify-kit` (maintained fork of Notifee, which is no longer maintained; Notifee-compatible API, Expo dev-build support). Compatibility with RN 0.86 is **not yet verified**.
- App side needs `@react-native-firebase/app` + `@react-native-firebase/messaging`, `google-services.json`, and a background handler.
- Backend then picks the sender by token type: `ExponentPushToken...` goes to Expo push API, any other token goes to FCM. `sendPushNotification` currently returns early unless the token starts with `ExponentPushToken`, so this must change.
- Android small notification icon must be white on transparent. `./assets/hero/main-logo.png` is currently used for the `expo-notifications` plugin icon, and `./assets/images/android-icon-monochrome.png` exists as a possible alternative.

## DONE (code already provided to the user; confirm each was applied)

### Backend
1. `routes/auth.js`: public avatar route, added above `router.get('/ip'`:
```javascript
// GET /api/auth/avatar/:userId (public avatar image, fetched by push notifications)
router.get('/avatar/:userId', async (req, res) => {
    try {
        const r = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.params.userId]);
        const url = r.rows[0]?.avatar_url;
        if (!url) return res.status(404).end();
        const m = url.match(/^data:(.+?);base64,(.+)$/);
        if (!m) return res.redirect(url);
        res.set('Content-Type', m[1]);
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(Buffer.from(m[2], 'base64'));
    } catch (err) {
        res.status(500).end();
    }
});
```
2. `utils/pushService.js`: added `mutableContent: true` to the Expo `message` object (after `data,`).
3. `utils/notifications.js`:
   - Added `API_BASE` (`process.env.PUBLIC_API_URL` or `https://campuscart-tdfn.onrender.com`).
   - Added `senderExtra(senderId, senderName, imageUrl = null)` returning `{ sender_id, sender_name, sender_avatar: <API_BASE>/api/auth/avatar/<senderId>, image_url? }`.
   - `insertNotification(userId, type, message, relatedId, link, pushTitle, pushBody, extra = {})`: new 8th parameter `extra`, spread into the push `data` (`{ link, related_id, type, ...extra }`).
   - `module.exports = { insertNotification, getPushTitle, senderExtra }`.
4. `routes/chat.js`:
   - Imports `senderExtra`, defines the same `API_BASE`.
   - Added public `GET /api/chat/media/:messageId` (serves only non-deleted `image` messages; message UUIDs act as unguessable ids), placed above `GET /:id/messages`.
   - Both `new_message` notifications (`POST /:id/media` and `POST /:id/messages`) now pass `senderExtra(req.userId, senderName, <image url or null>)`, where the image url is `${API_BASE}/api/chat/media/${inserted.rows[0].id}` when the message is an image.

### App
5. `app.json`: add `"bundleIdentifier": "com.sammy45.trex"` inside `expo.ios` (needed before the first iOS build). Confirm this was applied.

**Resulting push `data` payload** (what the app/extension receives): `link`, `related_id`, `type`, and for chat messages `sender_id`, `sender_name`, `sender_avatar` (URL), `image_url` (URL, only for image messages).

**Quick check:** open `https://campuscart-tdfn.onrender.com/api/auth/avatar/<a user id>` in a browser; the avatar should load.

## Existing push system (for reference)
- `POST /api/auth/me/push-token` saves `users.push_token` and re-sends up to 5 unread, un-pushed notifications (these resent pushes do not carry the sender `extra` data yet).
- `notifications` table has `pushed`, `push_title`, `push_body`. `logout` clears `push_token`.
- `getPushTitle(type)` maps notification types to titles.

## Blockers (why it is paused)
- The user tests on an **iPhone through Expo Go** (no EAS dev build installed). Expo Go always shows the Expo Go icon, and it cannot run an NSE or native FCM code.
- No **Apple Developer account** yet (the user will get one). Required for the iOS NSE/avatar style.
- No **Android device**. Option: free Android Studio emulator with a **"Google Play" system image** (needed for FCM).
- No Firebase project / `google-services.json` for `com.sammy45.trex` confirmed yet.

## NOT done yet
- Android: Firebase project, `google-services.json`, install `@react-native-firebase/*` and `react-native-notify-kit`, config plugins in `app.json`, EAS dev build, background message handler that builds the notification (circular avatar, small icon, big picture), backend FCM sender (`firebase-admin`) and token-type routing, app registering the native FCM token as `push_token`.
- iOS: Apple Developer account, EAS dev build, NSE target via config plugin (`react-native-notify-kit` has an `init-nse` CLI), Communication Notifications capability, intent donation using `sender_name` + `sender_avatar`, attachment from `image_url`.
- Make the re-sent pushes in `/me/push-token` include sender `extra` data if wanted.
- Other planned notification work (separate from styling): notification history view with day/week/month/all filters and delete (extension of the notification context).

## Files needed to continue
Always:
- `app.json` (current version)
- `eas.json`
- The app's `package.json`

Android work:
- The app code that registers for push and saves the token (where `expo-notifications` is used, the `push token saved` log) and any notification handler / listener setup
- Confirmation of Firebase project + `google-services.json` status, and emulator or device availability

iOS work:
- Confirmation of the Apple Developer account and EAS credentials setup

Backend changes:
- `utils/pushService.js`, `utils/notifications.js` (current versions), `package.json` (backend) if adding `firebase-admin`

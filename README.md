# EMily

EMily is a personal manga studio for Emily. She can turn photos and drawings into characters, build pages with panels, speech bubbles, and sound effects, then read the story like a book or save it to print.

Photos stay in the browser on this device. They are sent to [Venice AI](https://venice.ai) only when someone taps a **Draw with AI** or **Draw background** button, and only if `VENICE_API_KEY` is set on the computer running the app. There is no account and no analytics.

## Run it

```bash
npm install
npm run dev
```

Open the local address Vite prints (usually http://localhost:5173).

Everything except AI drawing works with no key and no network: photos, camera, crop, filters, cutout, stories, the reader, picture export, and PDF export.

```bash
npm run build
npm run lint
npm run preview
```

`npm run preview` can also draw with AI, because the same server plugin is included. A plain static host can open the built site, but the AI buttons stay off there.

## Add a Venice key

1. Copy `.env.example` to `.env`.
2. Put a key from https://venice.ai/settings/api in `VENICE_API_KEY`.
3. Restart `npm run dev`.

The key is read only by the Vite server. It is not bundled into the page and it is not stored in the browser.

Optional settings in `.env`:

- `VENICE_IMAGE_MODEL` defaults to `wai-Illustrious`. That model draws text-only pictures (a background with no photo) through `POST /image/generate`.
- `VENICE_EDIT_MODEL` defaults to `firered-image-edit`. A photo or drawing is sent as a reference through `POST /image/edit`, because `wai-Illustrious` cannot take a reference image. The trade-off is that the likeness follows the photo, while the anime look comes from the edit model rather than Illustrious.
- `VENICE_SAFE_MODE` defaults to `false`. Set it to `true` to send `safe_mode: true` on every picture request.
- `EMILY_MOCK_AI=1` is for development only. It turns the AI buttons on without calling Venice or spending money, and the app says practice mode is on.

`VENICE_SAFE_MODE` defaults to `false`, so picture requests send `safe_mode: false`. Set it to `true` and restart the dev server to turn Venice blurring back on. It is not a control in the app. If Venice marks a result as a content violation, or blurs it while safe mode is on, EMily does not show the picture. It asks her to try a different idea. Every prompt still asks for a fully clothed, wholesome, all-ages drawing.

## What image generation costs

Each **Draw with AI** press edits one photo with `firered-image-edit`. Venice's docs price that edit at about US$0.04. A background with no photo uses `wai-Illustrious` through text-to-image, listed at about US$0.01. Prompts ask for a fully clothed, wholesome, all-ages drawing.

Prices change. Check https://docs.venice.ai/models/image and your usage in the Venice dashboard before drawing a lot.

## Check it against a real key

Leave `EMILY_MOCK_AI` unset. After the key is in `.env` and `npm run dev` has been restarted:

```bash
npm run venice:check
```

That only checks the text model. Then, in the browser:

1. My characters, New character, add a photo, and use the crop or the whole picture.
2. Give the character a name. Under Draw with AI, pick a style, expression, and pose, then tap **Draw with AI**. The photo goes to `firered-image-edit`. A kept drawing appears on the character sheet. A blurred result shows “Let's try a different idea” and does not show the picture.
3. In a story, open Backgrounds, describe a place without attaching a photo, and tap **Draw background**. That call uses `wai-Illustrious` and does not send a picture.

## What's saved, and where

Stories, characters, and pictures are saved in this browser with IndexedDB, so real photos are not limited by localStorage. An older library saved in localStorage is moved over the first time the new app opens.

**Export backup** downloads one JSON file of the whole library, including the pictures. **Import backup** replaces what is on this device after a confirmation. Clearing the browser's site data deletes the studio unless that file was kept.

A story can also be saved as PNG pictures (a zip when there is more than one page) or as a PDF for sharing or printing.

# EMily

EMily is a personal manga studio for Emily. She can turn photos and drawings into characters, build pages with panels, speech bubbles, and sound effects, then read the story like a book or save it to print.

Photos stay in the browser on this device. They are sent to [Venice AI](https://venice.ai) only when someone taps **Draw with AI**, **Draw background**, or **Remove background** while AI drawing is on, and only if `VENICE_API_KEY` is set on the computer running the app. There is no account and no analytics.

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

The key is read only by the computer that draws: the Vite server locally, or the Cloudflare Worker when the public site is on. It is not bundled into the page and it is not stored in the browser.

Optional settings in `.env`:

- `VENICE_IMAGE_MODEL` defaults to `wai-Illustrious`. That model draws text-only pictures (a background with no photo) through `POST /image/generate`.
- `VENICE_EDIT_MODEL` defaults to `firered-image-edit`. A photo or drawing is sent as a reference through `POST /image/edit`, because `wai-Illustrious` cannot take a reference image. The trade-off is that the likeness follows the photo, while the anime look comes from the edit model rather than Illustrious.
- `VENICE_SAFE_MODE` defaults to `false`. Set it to `true` to send `safe_mode: true` on every picture request.
- `EMILY_MOCK_AI=1` is for development only. It turns the AI buttons on without calling Venice or spending money, and the app says practice mode is on.

`VENICE_SAFE_MODE` defaults to `false`, so picture requests send `safe_mode: false`. Set it to `true` and restart the dev server to turn Venice blurring back on. It is not a control in the app. If Venice marks a result as a content violation, or blurs it while safe mode is on, EMily does not show the picture. It asks her to try a different idea. Every prompt still asks for a fully clothed, wholesome, all-ages drawing.

## What image generation costs

Each **Draw with AI** press edits one photo with `firered-image-edit`. Venice's docs price that edit at about US$0.04. If **See-through background** is on (it starts on), EMily then calls `POST /image/background-remove` so the character comes back as a PNG with a real transparent background. Venice prices that cutout, model `bria-bg-remover`, at about US$0.03. The request sends only the picture. It does not send a model id or `safe_mode`. A background with no photo uses `wai-Illustrious` through text-to-image, listed at about US$0.01. Prompts ask for a fully clothed, wholesome, all-ages drawing. See-through drawings also ask for a plain flat white background, so a backup cutout on this device still has a solid color to remove.

If the cutout call fails for any reason other than a content violation, EMily does not spend a retry. It removes a flat background on this device instead, and she can tidy the edges with **Cut out background**. A content violation still hides the picture and shows “Let's try a different idea.” Turning **See-through background** off skips the extra call and keeps the background the drawing came with.

**Remove background** on a saved look does the same cutout and keeps the old look. With no key, and in practice mode (`EMILY_MOCK_AI=1`), that button only uses the on-device cutout.

Prices change. Check https://docs.venice.ai/models/image and your usage in the Venice dashboard before drawing a lot.

## Pictures inside a frame

A picture dropped into a panel can be slid and zoomed. Drag moves it. Pinch with two fingers, the corner handle, or **Bigger** / **Smaller** changes the size. **Fill frame** covers the panel. **Fit whole image** shows the whole picture inside it. Anything past the panel border is hidden in the editor, the reader, PNG export, and PDF export. The slide and zoom are saved with the page, and undo puts them back.

## Check it against a real key

Leave `EMILY_MOCK_AI` unset. After the key is in `.env` and `npm run dev` has been restarted:

```bash
npm run venice:check
```

That only checks the text model. Then, in the browser:

1. My characters, New character, add a photo, and use the crop or the whole picture.
2. Give the character a name. Under Draw with AI, leave **See-through background** on, pick a style, expression, and pose, then tap **Draw with AI**. The photo goes to `firered-image-edit`, then to background removal. A kept drawing appears on the character sheet with a checkerboard behind the empty parts. A blurred or violating result shows “Let's try a different idea” and does not show the picture. **Remove background** on an existing look sends that look through the same cutout.
3. In a story, open Backgrounds, describe a place without attaching a photo, and tap **Draw background**. That call uses `wai-Illustrious` and does not send a picture.
4. Place the character in a panel, tap **Fill frame**, and drag the picture. The edges stay inside the frame on the page, in the reader, and in a saved PNG or PDF.

## What's saved, and where

Stories, characters, and pictures are saved in this browser with IndexedDB, so real photos are not limited by localStorage. An older library saved in localStorage is moved over the first time the new app opens.

**Export backup** downloads one JSON file of the whole library, including the pictures. **Import backup** replaces what is on this device after a confirmation. Clearing the browser's site data deletes the studio unless that file was kept.

A story can also be saved as PNG pictures (a zip when there is more than one page) or as a PDF for sharing or printing. See-through characters are stored as PNG so the empty background stays empty. Page pictures and PDFs draw that character on the paper, and they clip anything that sits outside a panel.

## Publish it for Emily

The public site is a static build on GitHub Pages: https://4n0nym0u5-creator.github.io/EMily/

Drawings go to a Cloudflare Worker so the Venice key never sits in the page. Every drawing request must send `X-Emily-Passcode`. The first time she taps an AI button, EMily asks her to get the magic word from a grown-up and remembers it in this browser. A wrong word is cleared and she can ask again. Photos, stories, filters, the reader, and export work with no word and no network.

### Worker

From this folder:

```bash
npm run deploy:worker
```

That runs `npx wrangler deploy` with `worker/wrangler.toml` (Worker name `emily-ai`). The same commands from inside `worker/` are:

```bash
npx wrangler deploy
npx wrangler secret put VENICE_API_KEY
npx wrangler secret put EMILY_PASSCODE
```

`VENICE_SAFE_MODE` defaults to `false` in `worker/wrangler.toml`. Change that var and deploy again if you want blurring. Do not put the key or the magic word in the repo.

The Worker allows browsers only from https://4n0nym0u5-creator.github.io, http://localhost:5173, and http://127.0.0.1:5173. It refuses a picture bigger than 12MB. Each isolate also stops at 8 drawings in 10 minutes and 40 in a day. That counter lives in memory, so it is not shared across Cloudflare locations and it resets when the isolate goes away. For a daily cap that is shared, create a KV namespace and uncomment the `LIMITS` binding in `worker/wrangler.toml`:

```bash
npx wrangler kv namespace create LIMITS
```

### Pages

1. In the GitHub repo, open Settings → Pages → Build and deployment, and set Source to GitHub Actions.
2. Deploy the Worker and copy its `workers.dev` URL.
3. In the repo, open Settings → Secrets and variables → Actions → Variables, and set `VITE_API_BASE` to that URL, for example `https://emily-ai.<subdomain>.workers.dev`. This value is public. It is the only `VITE_` setting the Pages build needs. Do not add the Venice key or the magic word as a Pages secret.
4. Push to `main`, or run the "Deploy GitHub Pages" workflow by hand. The workflow sets Vite's base to `/EMily/` so local `npm run dev` still uses `/`.

Until `VITE_API_BASE` is set, the site still opens and every local tool works. The AI buttons stay off because there is no drawing server.

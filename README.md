# EMily

EMily is a personal manga studio for Emily. She can turn photos and drawings into characters, build pages with panels, speech bubbles, and sound effects, then read the story like a book or save it to print.

Photos stay in the browser on this device. They are sent to OpenAI only when someone taps a **Draw with AI** button, and only if an API key is configured on the computer running the app. There is no account and no analytics.

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

## Add an OpenAI key

1. Copy `.env.example` to `.env`.
2. Put a key from https://platform.openai.com/api-keys in `OPENAI_API_KEY`.
3. Restart `npm run dev`.

The key is read only by the Vite server. It is not bundled into the page and it is not stored in the browser.

Optional settings in `.env`:

- `OPENAI_IMAGE_QUALITY=low` spends less than the default `medium`. `high` costs more.
- `EMILY_MOCK_AI=1` is for development only. It turns the AI buttons on without calling OpenAI or spending money, and the app says practice mode is on.

## What image generation costs

Each AI button press creates one picture with `gpt-image-1`. The app asks for medium quality unless you change `OPENAI_IMAGE_QUALITY`, and it uses high input fidelity so the drawing can keep the face from the photo. That is more expensive than a plain text prompt.

OpenAI's prices change. Check the current image rates at https://platform.openai.com/docs/pricing and watch usage at https://platform.openai.com/usage. A grown-up should expect each picture to cost a small amount of money, often a few cents at medium quality, and more if quality is set to high.

## What's saved, and where

Stories, characters, and pictures are saved in this browser with IndexedDB, so real photos are not limited by localStorage. An older library saved in localStorage is moved over the first time the new app opens.

**Export backup** downloads one JSON file of the whole library, including the pictures. **Import backup** replaces what is on this device after a confirmation. Clearing the browser's site data deletes the studio unless that file was kept.

A story can also be saved as PNG pictures (a zip when there is more than one page) or as a PDF for sharing or printing.

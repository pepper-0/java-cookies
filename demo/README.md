# LimaDRC web demo

This folder contains a standalone, browser-based walkthrough of LimaDRC. It is intended for presentations and public project links. The results are scripted and the page does not load the mobile TensorFlow Lite model.

## Run locally

```bash
cd demo
npm install
npm run dev
```

Open the local URL printed by Vite.

## Verify the production build

```bash
npm run build
npm run preview
```

The production files are generated in `dist/`.

## Deploy through the Vercel dashboard

1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `demo`.
3. Leave **Framework Preset** as Vite (Vercel should detect it automatically).
4. Confirm **Build Command** is `npm run build`.
5. Confirm **Output Directory** is `dist`.
6. No environment variables are required.
7. Select **Deploy**.

Vercel cannot access repository files above the configured Root Directory, so all sample photos used by this site are intentionally stored in `demo/public/images/`.

## Demonstration behavior

- Selecting a bundled sample returns the result paired with that sample.
- Uploading a custom image previews it locally and returns a scripted Cassava Mosaic Disease result.
- Uploaded images never leave the browser.
- Browser speech synthesis provides optional spoken guidance where supported.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/dcfb0e0d-8ada-473b-bd7b-a46f337bf6ed

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Reading library

- The bookshelf keeps multiple articles, vocabulary, notes and reading status.
- Legacy `lumina-reader-session` data migrates automatically; the original key and
  legacy database records are preserved. JSON backups can be exported/imported.
- English and Chinese are stored as paragraph pairs with stable IDs. An empty
  translation never changes the index of later translations. The reader hides
  translations by default and restores the last paragraph and offset.
- Linked devices use one library. Updates use optimistic revisions. Independent
  article edits merge; simultaneous edits to one article retain a conflict copy.
  Focus, reconnect and a 20-second poll refresh other-device changes. Offline
  changes remain local until the server acknowledges a write.

### Validation and Cloudflare Pages

Use Node.js 24 for the test suite (`node:sqlite`).

```sh
npm ci
npm run lint
npm test
npm run build
# Apply the additive migration before deploying the new Functions.
npx wrangler d1 migrations apply lumina-reader-db --remote
npx wrangler pages deploy dist --project-name lumina-reader --branch main
```

The shared-library API requires Cloudflare Pages Functions and the existing D1
binding. A static GitHub Pages deployment supports local storage and backups but
cannot provide cross-device synchronization. Cloudflare production is
https://lumina-reader-ezz.pages.dev/.

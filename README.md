# Imposter Who?

Pass-the-device party app for setup and secret-word reveal. Hosts pick the roster and rules; each player holds a private card to peek, then the group sees who starts and a recap.

Play in the browser on a shared device. Spoken clues, voting, and scoring stay at the table.

## Run

```bash
npm install
npm test
npm run dev
```

Then open the printed URL (http://127.0.0.1:5173). Production build: `npm run build` then `npm run preview`.

The app is a static TypeScript SPA bundled with esbuild. Vite cannot load this repository because the folder name contains `?`, which it treats as a URL query.

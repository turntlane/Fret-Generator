# Fret Slot CNC G-Code Builder

A Next.js app for generating CNC G-code to cut radiused fret slots and optional fretboard marker pockets.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

This project uses Next.js static export mode. Production assets are written to `out/`.

## Netlify

The repository includes `netlify.toml` with:

- Build command: `npm run build`
- Publish directory: `out`
- Node version: `20`

In Netlify, connect the Git repository and use the settings from `netlify.toml`.

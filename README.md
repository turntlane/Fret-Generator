# Fretboard CNC G-Code Builder

A Next.js app for generating CNC G-code to radius a fretboard top, cut radiused fret slots, profile the fretboard outline, and cut optional fretboard marker pockets.

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

## SEO

Metadata, Open Graph image, `robots.txt`, `sitemap.xml`, web manifest and JSON-LD structured data are generated at build time from `app/site.ts`.

Set `NEXT_PUBLIC_SITE_URL` to the production origin (for example `https://your-domain.com`) in the Netlify build environment so canonical and Open Graph URLs point at the live site. Without it the fallback in `app/site.ts` is used.

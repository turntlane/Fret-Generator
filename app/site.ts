/**
 * Site-wide SEO constants. Edit here; layout, sitemap, robots, manifest,
 * Open Graph image and JSON-LD all read from this file.
 *
 * Set NEXT_PUBLIC_SITE_URL in the Netlify build environment (or .env) to the
 * production origin so canonical / Open Graph URLs resolve correctly.
 */
const FALLBACK_SITE_URL = "https://fretgenerator.com";

export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL,
);

export const siteName = "Fretboard G-Code Builder";

export const siteTitle =
  "Fretboard G-Code Builder – Free CNC Fret Slot, Radius & Cutout Generator";

export const siteDescription =
  "Free online CNC G-code generator for guitar and bass fretboards. Enter scale length, fret count, nut and bridge string spread and fretboard radius to generate fret slot, top radius surfacing, outline cutout and inlay marker toolpaths. Exports .nc, .gcode, .tap, .cnc and .ngc files for GRBL, Mach3, LinuxCNC and other CNC routers. No signup required.";

export const siteKeywords = [
  "fretboard g-code generator",
  "fret slot g-code",
  "fret slot cnc",
  "cnc fretboard",
  "fretboard radius cnc",
  "fingerboard cnc g-code",
  "guitar fretboard cnc router",
  "fret slotting cnc",
  "fret spacing calculator",
  "fret position calculator",
  "fretboard radius toolpath",
  "compound radius fretboard cnc",
  "fretboard cutout g-code",
  "fret marker inlay cnc",
  "luthier cnc",
  "guitar building cnc",
  "bass fretboard g-code",
  "scale length fret calculator",
  "grbl g-code generator",
  "mach3 g-code generator",
  "linuxcnc fretboard",
  "free g-code generator",
  "luthiery tools",
  "guitar neck cnc",
];

export const authorName = "Jake Alexander";
export const authorEmail = "imjakeal@gmail.com";
export const sourceRepositoryUrl = "https://github.com/turntlane/Fret-Generator";

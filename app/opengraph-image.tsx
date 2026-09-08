import { ImageResponse } from "next/og";
import { siteName } from "./site";

export const dynamic = "force-static";

export const alt =
  "Fretboard G-Code Builder – free CNC fret slot, radius, cutout and marker G-code generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Fret positions for a 12-fret preview strip (12-TET spacing, normalised). */
const fretRatios = Array.from({ length: 13 }, (_, i) => 1 - 1 / 2 ** (i / 12));
const stripScale = 1 / fretRatios[12];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: "#f2ead7",
          color: "#2b2620",
          fontFamily: "Georgia, serif",
          border: "6px solid #2b2620",
          boxShadow: "inset 0 0 0 6px #f2ead7, inset 0 0 0 10px #2b2620",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#6e6354",
              fontWeight: 700,
            }}
          >
            Form FB-22 · Luthiery Dept.
          </div>
          <div
            style={{
              fontSize: 82,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              lineHeight: 1.05,
              marginTop: 8,
            }}
          >
            {siteName}
          </div>
          <div
            style={{
              fontSize: 26,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#9b3b2a",
              fontWeight: 700,
              marginTop: 14,
            }}
          >
            Surface · Slots · Cutout · Markers
          </div>
        </div>

        <div
          style={{
            display: "flex",
            position: "relative",
            height: 96,
            background: "#faf4e4",
            border: "4px solid #2b2620",
          }}
        >
          {fretRatios.map((ratio, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${ratio * stripScale * 100}%`,
                width: 5,
                background: "#2b2620",
              }}
            />
          ))}
          {[3, 5, 7, 9].map((fret) => (
            <div
              key={fret}
              style={{
                position: "absolute",
                top: 36,
                left: `${((fretRatios[fret - 1] + fretRatios[fret]) / 2) * stripScale * 100}%`,
                width: 24,
                height: 24,
                marginLeft: -12,
                borderRadius: 12,
                background: "#1f6e54",
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 28,
            color: "#2b2620",
          }}
        >
          <div style={{ display: "flex" }}>
            Free CNC G-code generator for guitar &amp; bass fretboards
          </div>
          <div style={{ display: "flex", color: "#6e6354" }}>
            .nc · .gcode · .tap · .ngc
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

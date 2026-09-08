import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "./site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "Fret G-Code",
    description: siteDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#f2ead7",
    theme_color: "#2b2620",
    categories: ["utilities", "productivity"],
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}

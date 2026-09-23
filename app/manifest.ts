import type { MetadataRoute } from "next";

/**
 * Web App Manifest (FR-20) — dibuat Next di /manifest.webmanifest.
 * Wajib untuk kriteria installable Lighthouse (FR-22):
 * name + start_url + display standalone + icon 192 & 512 (+ maskable).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WedPlan — Wedding Planner",
    short_name: "WedPlan",
    description:
      "WedPlan membantu calon pengantin mengelola checklist, budget, dan vendor pernikahan dari satu dashboard.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#e11d48",
    lang: "id",
    dir: "ltr",
    categories: ["lifestyle", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

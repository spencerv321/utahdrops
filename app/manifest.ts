import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/config";

/** Lets people add Utah Drops to their home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: "Find any bottle in Utah's state stores. Get alerted when it's back. Never miss a drop.",
    start_url: "/",
    display: "standalone",
    background_color: "#15100d",
    theme_color: "#15100d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

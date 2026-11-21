import { APP_NAME } from "@/lib/brand";

export default function manifest() {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Organize business leads from email and phone.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3eef8",
    theme_color: "#3b0764",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

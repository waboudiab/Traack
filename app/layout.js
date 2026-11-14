import "./globals.css";
import { APP_NAME } from "@/lib/brand";
import Providers from "./providers";
import PwaRegister from "./pwa-register";
import InstallHint from "./install-hint";

export const metadata = {
  title: APP_NAME,
  description: "Organize shop leads from email and phone.",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#3b0764",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
        <InstallHint />
      </body>
    </html>
  );
}

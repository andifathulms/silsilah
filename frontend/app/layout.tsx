import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silsilah — Your family's story, beautifully mapped",
  description:
    "Build a living family tree with the people you love. Add relatives, preserve photos and stories, and explore generations in an interactive, elegant view.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Silsilah", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#14503a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('silsilah_theme');if(t){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silsilah — Your family's story, beautifully mapped",
  description:
    "Build a living family tree with the people you love. Add relatives, preserve photos and stories, and explore generations in an interactive, elegant view.",
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
      <body>{children}</body>
    </html>
  );
}

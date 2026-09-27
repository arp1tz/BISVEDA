import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "BISVEDA | AI Assistant for Indian Standards & BIS Services",
  description:
    "Grounded, source-backed intelligence platform for discovering Indian Standards, mandatory QCOs, testing laboratories, and certification schemes — Bureau of Indian Standards.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}

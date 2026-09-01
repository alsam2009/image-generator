import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {\
  title: "AI Image Generator",\
  description: "Generate stunning images with AI",\
  icons: {\
    icon: '/favicon.ico',\
  },\
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

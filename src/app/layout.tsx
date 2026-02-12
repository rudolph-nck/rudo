import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "RUDO.AI — The AI Creator Platform",
  description:
    "The world's first social platform where every creator is an AI. Build AI personalities, deploy them to create content autonomously.",
  keywords: ["AI", "social media", "bot", "creator", "artificial intelligence"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { PracticeProvider } from "@/components/PracticeProvider";
export const metadata: Metadata = {
  title: { default: "Layer — One layer at a time", template: "%s · Layer" },
  description:
    "A considered place to learn miniature painting. Discover a palette, practise a technique, and make something you’re proud of.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <PracticeProvider>{children}</PracticeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "마디 레시피 공방 | 멜로디아 음악이론 어드벤처",
  description: "음표 재료를 조합해 마디를 완성하고, 직접 리듬을 연주하는 음악이론 게임.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

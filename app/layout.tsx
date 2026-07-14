import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "마디 레시피 공방 | 멜로디아 음악이론 어드벤처",
    description: "음표 재료를 조합해 마디를 완성하고, 직접 리듬을 연주하는 음악이론 게임.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "마디 레시피 공방",
      description: "리듬을 만들고 연주해요.",
      type: "website",
      locale: "ko_KR",
      images: [{ url: "/og.png", width: 1672, height: 928, alt: "마디 레시피 공방 리듬 게임" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "마디 레시피 공방",
      description: "리듬을 만들고 연주해요.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

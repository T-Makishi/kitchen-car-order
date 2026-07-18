import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: { default: "まちの小さなキッチンカー", template: "%s｜まちの小さなキッチンカー" },
    description: "できたてを、待たずに。メニューを選び、受取時間を指定できる公式事前注文アプリ。",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
    openGraph: { title: "まちの小さなキッチンカー", description: "できたてを、待たずに。スマートフォンから事前注文。", type: "website", images: [{ url: new URL("/og.png", metadataBase), width: 1729, height: 910, alt: "まちの小さなキッチンカーの事前注文" }] },
    twitter: { card: "summary_large_image", title: "まちの小さなキッチンカー", description: "できたてを、待たずに。", images: [new URL("/og.png", metadataBase)] },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#10110f", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}<script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}` }} /></body></html>;
}

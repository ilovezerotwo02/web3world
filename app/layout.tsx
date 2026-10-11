import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "web3world · Web3 像素学习世界",
  description: "把 Web3 知识放进地图、课程土地、回执池塘和安全训练场，边探索边验证。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "web3world · Web3 像素学习世界",
    description: "Explore Web3, inspect transactions, and build a verifiable learning record.",
    images: [{ url: "/og-v35.png", width: 1440, height: 900 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-v35.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

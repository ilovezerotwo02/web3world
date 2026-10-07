import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monad 像素农场",
  description: "在治愈系像素农场中学习 Web3，让知识种子经历发芽、开花、结果与收获。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Monad Pixel Farm",
    description: "Learn Web3, grow knowledge, and keep a verifiable learning record.",
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

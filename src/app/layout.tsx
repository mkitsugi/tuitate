import type { Metadata } from "next";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const nunito = Nunito({ subsets: ["latin"] });

// カスタムフォントの読み込み
const customFont = localFont({
  src: "../../public/fonts/tamanegi_kaisho.ttf",
  display: "swap",
});

export const metadata: Metadata = {
  title: "霧将棋",
  description: "索敵しながら王を仕留めろ！新感覚の将棋ゲーム「霧将棋」",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={customFont.className}>
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}

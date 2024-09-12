import type { Metadata } from "next";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";
const nunito = Nunito({ subsets: ["latin"] });

// カスタムフォントの読み込み
const customFont = localFont({
  src: "../../public/fonts/tamanegi_kaisho.ttf",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "霧将棋 | 新感覚の将棋ゲーム",
    template: "%s | 霧将棋",
  },
  description: "索敵しながら王を仕留めろ！新感覚の不完全情報将棋ゲーム「霧将棋」",
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "霧将棋 | 新感覚の将棋ゲーム",
    description: "索敵しながら王を仕留めろ！新感覚の将棋ゲーム「霧将棋」",
    type: "website",
    url: "https://kirishogi.com",
    images: [
      {
        url: 'https://kirishogi.com/ogp/image-m.png',
        width: 1200,
        height: 630,
        alt: '霧将棋 | 新感覚の将棋ゲーム',
      },
      {
        url: 'https://kirishogi.com/ogp/image-s.png',
        width: 400,
        height: 300,
        alt: '霧将棋 | 新感覚の将棋ゲーム',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '霧将棋 | 新感覚の将棋ゲーム',
    description: '索敵しながら王を仕留めろ！新感覚の将棋ゲーム「霧将棋」',
    images: ['https://kirishogi.com/ogp/image-1200x630.png'],
    creator: '@palpa_kg',
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
        <link rel="canonical" href="https://kirishogi.com" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-W7ZTTZCN3W"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-W7ZTTZCN3W');
          `}
        </Script>
      </head>
      <body className={customFont.className}>
        {children}
        <Toaster richColors duration={1000} />
      </body>
    </html>
  );
}

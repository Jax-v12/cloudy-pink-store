import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { publicSiteOrigin } from '@/lib/siteMetadata';
import AggregateMetrics from '@/components/AggregateMetrics';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cloudy Pink Store — Aplikasi Premium & Robux",
  description: "Aplikasi premium dan isi ulang Robux untuk Indonesia. Periksa paket, ketentuan, pembayaran, dan perkembangan pesanan.",
  ...(publicSiteOrigin() ? { metadataBase: new URL(publicSiteOrigin()!), openGraph: { title: 'Cloudy Pink Store', description: 'Aplikasi premium dan isi ulang Robux untuk Indonesia', images: ['/banner-logo.png'], type: 'website' as const } } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <AggregateMetrics active={process.env.AGGREGATE_METRICS_ENABLED === 'true'} />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}

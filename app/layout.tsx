// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Import global styles (bao gồm cả Tailwind)
import ThemeProvider from "@/components/ThemeProvider"; // Import ThemeProvider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Google Drive Mini - Windows Style",
  description: "Một ứng dụng quản lý file mini giống Google Drive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-100 dark:bg-zinc-900 transition-colors duration-300`}>
        <ThemeProvider>
           {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
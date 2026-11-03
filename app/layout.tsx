// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Import global styles (bao gồm cả Tailwind)
import ThemeProvider from "@/components/ThemeProvider"; // Import ThemeProvider

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cloudflare Drive Mini - R2 Storage",
  description: "Ứng dụng quản lý tệp tin trực tuyến mini trên nền tảng Cloudflare R2 Storage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  
                  if (theme === 'dark' || (!theme && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  console.error('Theme initialization error:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen transition-colors duration-300`}>
        <ThemeProvider>
           {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
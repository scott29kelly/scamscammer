import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ScamScrammer - AI-Powered Scam Call Entertainment',
  description: 'Keep scammers on the line with Earl, the AI-powered confused elderly persona',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}

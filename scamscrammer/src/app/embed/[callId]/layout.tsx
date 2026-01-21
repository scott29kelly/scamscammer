/**
 * Embed Layout
 *
 * Minimal layout for the embed page - removes default styling
 * to allow the embed to be fully customized by theme param.
 */

import '@/app/globals.css';

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="m-0 p-0 overflow-hidden">
        {children}
      </body>
    </html>
  );
}

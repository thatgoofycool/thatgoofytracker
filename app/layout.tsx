import '../styles/globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'Album Progress Tracker',
  description: 'Track song progress with secure previews and tags',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.PLAUSIBLE_DOMAIN;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        {plausibleDomain ? (
          <script defer data-domain={plausibleDomain} src={`https://plausible.io/js/script.js`}></script>
        ) : null}
      </body>
    </html>
  );
}



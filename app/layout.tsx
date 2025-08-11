import '../styles/globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ThemeProvider } from 'next-themes';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Album Progress Tracker',
  description: 'Secure music management application.',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.PLAUSIBLE_DOMAIN;
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        {plausibleDomain ? (
          <script defer data-domain={plausibleDomain} src={`https://plausible.io/js/script.js`}></script>
        ) : null}
      </body>
    </html>
  );
}



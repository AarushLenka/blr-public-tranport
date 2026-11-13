import type { Metadata, Viewport } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/tokens.css';
import './globals.css';
import './planner.css';
import './responsive.css';

export const metadata: Metadata = {
  title: {
    default: 'Bengaluru Transit | Metro and bus route planner',
    template: '%s | Bengaluru Transit',
  },
  description:
    'Plan a Namma Metro and BMTC journey across Bengaluru. Compare the metro and bus, see where to change, and know the walk before you leave.',
  applicationName: 'Bengaluru Transit',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Bengaluru Transit',
    description: 'Metro and bus, planned as one route. Namma Metro and BMTC across Bengaluru.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f8f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0a2022' },
  ],
};

/* Runs before first paint so a saved or system dark theme never flashes light. */
const themeBootstrap = `(function(){try{var t=localStorage.getItem('blr-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-type="software" suppressHydrationWarning>
      <head>
        <meta name="page-type" content="software" />
        <meta name="site-kind" content="software" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <link rel="preload" href="/fonts/SourceSerif4-Variable.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/DMSans-Variable.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}

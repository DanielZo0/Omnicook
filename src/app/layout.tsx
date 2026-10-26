import type { Metadata, Viewport } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Omnicook',
  description: 'Your recipe universe',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/omnicook-icon.svg?v=skillet-1', apple: '/apple-touch-icon.png?v=skillet-1' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Omnicook' },
};

export const viewport: Viewport = {
  themeColor: '#f9d94e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
    </head>
    <body>{children}</body>
  </html>;
}

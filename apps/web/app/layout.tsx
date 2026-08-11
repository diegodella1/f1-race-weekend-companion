import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/chivo/wght.css';
import '@fontsource-variable/chivo/wght-italic.css';
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import { AppProviders } from '@/components/shared/app-providers';
import { ServiceWorkerRegister } from '@/components/shared/service-worker-register';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'F1 Companion', template: '%s · F1 Companion' },
  description: 'Race-weekend timing translated into battles, pace, tyres and strategy context.',
  applicationName: 'F1 Companion',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/app-icon.svg', apple: '/icons/app-icon.svg' },
  appleWebApp: { capable: true, title: 'F1 Companion', statusBarStyle: 'black-translucent' }
};

export const viewport: Viewport = { themeColor: '#0e0e0e', colorScheme: 'dark', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><AppProviders>{children}</AppProviders><ServiceWorkerRegister /></body>
    </html>
  );
}

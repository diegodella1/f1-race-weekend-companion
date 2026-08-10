import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'F1 Race Weekend Companion',
    short_name: 'F1 Companion',
    description: 'Live race context, battles, tyres and strategy.',
    start_url: '/weekend',
    display: 'standalone',
    background_color: '#0B0D10',
    theme_color: '#0B0D10',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
    ]
  };
}

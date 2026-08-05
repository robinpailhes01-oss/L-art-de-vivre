import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "L'art de vivre",
    short_name: "L'art de vivre",
    description: "Pilotage conciergerie — leads, WhatsApp, facturation de l'agent IA.",
    start_url: '/',
    display: 'standalone',
    background_color: '#1f3d2b',
    theme_color: '#1f3d2b',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}

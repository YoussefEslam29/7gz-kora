// Generates the app icons from public/logo.svg. Run `npm run icons` after
// changing the logo. Output (in public/): favicon.ico, pwa-64x64.png,
// pwa-192x192.png, pwa-512x512.png, maskable-icon-512x512.png and
// apple-touch-icon-180x180.png.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    // Home screen icons: the round badge on white, large enough to read.
    // (Maskable icons must keep the logo inside the centre 80% circle.)
    maskable: { ...minimal2023Preset.maskable, padding: 0.2, resizeOptions: { background: '#FFFFFF' } },
    apple: { ...minimal2023Preset.apple, padding: 0.12, resizeOptions: { background: '#FFFFFF' } },
  },
  images: ['public/logo.svg'],
})

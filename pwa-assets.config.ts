// Generates the app icons from public/app-icon.svg (the boot-on-ball on
// green, no text). Run `npm run icons` after changing it. Output (in public/):
// favicon.ico, pwa-64x64.png, pwa-192x192.png, pwa-512x512.png,
// maskable-icon-512x512.png and apple-touch-icon-180x180.png.
// app-icon.svg is already a full green square with the mark inside the safe
// zone, so no extra padding or background is added.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/app-icon.svg'],
})

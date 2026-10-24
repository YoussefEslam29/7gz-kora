// Builds the PNG app icons in this folder from app-icon.svg.
// Run from the project root:  npx pwa-assets-generator -c Design/icons/pwa-assets.config.ts
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
  images: ['Design/icons/app-icon.svg'],
})

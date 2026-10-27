import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The Install screen is all the public website may show, so the development
// bypass must never reach the live site (Plans/Install-first-access.md).
if (process.env.VERCEL && process.env.VITE_ALLOW_BROWSER === 'true') {
  throw new Error('VITE_ALLOW_BROWSER must never be set on Vercel. Remove it from the project settings.')
}

// Link previews (WhatsApp etc.) need the icon's full address. On Vercel that
// is the production domain; locally a relative path is fine.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''

function siteUrlInHtml(): Plugin {
  return {
    name: 'site-url-in-html',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
  }
}

/** /api/map-link inside `npm run dev` too (on Vercel it's the function in api/map-link.ts). */
function mapLinkInDev(): Plugin {
  return {
    name: 'map-link-in-dev',
    configureServer(server) {
      server.middlewares.use('/api/map-link', (req, res) => {
        void (async () => {
          const { default: helper } = (await server.ssrLoadModule('/api/map-link.ts')) as {
            default: { fetch: (request: Request) => Promise<Response> }
          }
          const response = await helper.fetch(new Request(new URL(req.url ?? '/', 'http://localhost')))
          res.statusCode = response.status
          res.setHeader('content-type', 'application/json')
          res.end(await response.text())
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    siteUrlInHtml(),
    mapLinkInDev(),
    VitePWA({
      // New versions install themselves; friends get updates on next open.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'app-icon.svg', 'logo.svg', 'mark-green.svg'],
      // Name and icon only: no description (the public sees nothing else).
      manifest: {
        id: '/',
        name: '7GZ-KORA',
        short_name: '7GZ-KORA',
        lang: 'en',
        theme_color: '#00BF63',
        background_color: '#00BF63',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Data always comes fresh from Supabase.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // The privacy page is its own page, not part of the app.
        navigateFallbackDenylist: [/^\/privacy\.html$/],
        navigateFallback: '/index.html',
      },
    }),
  ],
})

// Which install steps the Install screen shows (Plans/Install-first-access.md section 2).

export type InstallTarget =
  | 'ios-safari' // iPhone or iPad in Safari: Share → Add to Home Screen
  | 'ios-other' // iPhone inside another app or browser: open in Safari first
  | 'android-chrome' // Android Chrome: Install app
  | 'android-other' // Android in-app or other browser: open in Chrome first
  | 'desktop-chromium' // Computer, Chrome or Edge: Install app
  | 'mac-safari' // Mac Safari: File → Add to Dock
  | 'other' // Anything else (e.g. Firefox): open in Chrome or Edge

export function installTarget(userAgent: string, maxTouchPoints: number): InstallTarget {
  const ua = userAgent
  // iPads asking for the desktop site report themselves as Macs, but Macs have no touch screen.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  const safari = /Version\/[\d.]+.*Safari\//.test(ua)

  if (ios) {
    return safari && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? 'ios-safari' : 'ios-other'
  }
  if (/Android/i.test(ua)) {
    // In-app browsers (WhatsApp, Instagram, Facebook...) mark themselves with "wv".
    const otherBrowser = /; wv\)|SamsungBrowser|Firefox|EdgA|OPR|YaBrowser|UCBrowser|MiuiBrowser|FBAN|FBAV|Instagram/
    return /Chrome\/[\d.]+/.test(ua) && !otherBrowser.test(ua) ? 'android-chrome' : 'android-other'
  }
  if (/Chrome\/[\d.]+/.test(ua) && !/OPR\/|YaBrowser/.test(ua)) return 'desktop-chromium'
  if (/Macintosh/.test(ua) && safari) return 'mac-safari'
  return 'other'
}

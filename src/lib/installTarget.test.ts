import { describe, expect, it } from 'vitest'
import { installTarget } from './installTarget'

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 380.0.0.0.0',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.0 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  androidInApp:
    'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
}

describe('installTarget: which steps the Install screen shows', () => {
  it('iPhone: Safari installs; any other app or browser must open Safari first', () => {
    expect(installTarget(UA.iphoneSafari, 5)).toBe('ios-safari')
    expect(installTarget(UA.iphoneInstagram, 5)).toBe('ios-other')
    expect(installTarget(UA.iphoneChrome, 5)).toBe('ios-other')
  })
  it('an iPad asking for the desktop site is still an iPad; a Mac is a Mac', () => {
    expect(installTarget(UA.macSafari, 5)).toBe('ios-safari')
    expect(installTarget(UA.macSafari, 0)).toBe('mac-safari')
  })
  it('Android: Chrome installs; in-app and other browsers must open Chrome first', () => {
    expect(installTarget(UA.androidChrome, 5)).toBe('android-chrome')
    expect(installTarget(UA.androidInApp, 5)).toBe('android-other')
    expect(installTarget(UA.androidSamsung, 5)).toBe('android-other')
  })
  it('computers: Chrome and Edge install; anything else is told to use them', () => {
    expect(installTarget(UA.windowsChrome, 0)).toBe('desktop-chromium')
    expect(installTarget(UA.windowsEdge, 0)).toBe('desktop-chromium')
    expect(installTarget(UA.firefox, 0)).toBe('other')
  })
})

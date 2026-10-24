import { describe, expect, it } from 'vitest'
import { appMode, inviteCodeFromUrl } from './access'

describe('appMode: Install screen or the app?', () => {
  it('a browser sees only the Install screen', () => {
    expect(appMode({ standalone: false, allowBrowser: false })).toBe('install')
  })
  it('the installed app runs the app', () => {
    expect(appMode({ standalone: true, allowBrowser: false })).toBe('app')
  })
  it('the development setting lets a browser run the app', () => {
    expect(appMode({ standalone: false, allowBrowser: true })).toBe('app')
  })
})

describe('inviteCodeFromUrl', () => {
  it('reads and cleans the code of an invite link', () => {
    expect(inviteCodeFromUrl('/join', '?code=kick-7q3f')).toBe('KICK-7Q3F')
    expect(inviteCodeFromUrl('/join', '?code=<b>KICK</b>')).toBe('BKICKB')
  })
  it('ignores other pages and empty codes', () => {
    expect(inviteCodeFromUrl('/', '?code=KICK-7Q3F')).toBeNull()
    expect(inviteCodeFromUrl('/join', '')).toBeNull()
  })
})

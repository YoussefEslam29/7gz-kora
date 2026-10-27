import { describe, expect, it } from 'vitest'
import { checkPhone, formatPhone } from './phone'

describe('the InstaPay number', () => {
  it('saves every way of typing an Egyptian mobile number as 11 digits', () => {
    for (const typed of ['01012345678', '+20 10 1234 5678', '0020 1012345678', '010-1234-5678', ' 010 1234 5678 ']) {
      expect(checkPhone(typed)).toEqual({ ok: true, phone: '01012345678' })
    }
    expect(checkPhone('01112345678')).toEqual({ ok: true, phone: '01112345678' })
    expect(checkPhone('01512345678')).toEqual({ ok: true, phone: '01512345678' })
  })

  it('empty means no number', () => {
    expect(checkPhone('')).toEqual({ ok: true, phone: null })
    expect(checkPhone('   ')).toEqual({ ok: true, phone: null })
  })

  it('refuses numbers that are too short or have no mobile prefix', () => {
    expect(checkPhone('0101234567')).toEqual({ ok: false })
    expect(checkPhone('01312345678')).toEqual({ ok: false })
    expect(checkPhone('hello')).toEqual({ ok: false })
  })

  it('shows it in three groups', () => {
    expect(formatPhone('01012345678')).toBe('010 1234 5678')
  })
})

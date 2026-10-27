// The InstaPay number (Plans/Accounts-groups-and-chat.md section 7): an
// Egyptian mobile number, saved as 11 digits. Tested in phone.test.ts.
const MOBILE = /^01[0125]\d{8}$/

export type PhoneCheck = { ok: true; phone: string | null } | { ok: false }

/** "+20 10 1234 5678", "0020 1012345678" and "010-1234-5678" all become "01012345678". Empty is no number. */
export function checkPhone(typed: string): PhoneCheck {
  let digits = typed.replace(/[\s\-().]/g, '')
  if (digits === '') return { ok: true, phone: null }
  if (digits.startsWith('+20')) digits = `0${digits.slice(3)}`
  else if (digits.startsWith('0020')) digits = `0${digits.slice(4)}`
  return MOBILE.test(digits) ? { ok: true, phone: digits } : { ok: false }
}

/** "01012345678" -> "010 1234 5678" */
export function formatPhone(phone: string): string {
  return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`
}

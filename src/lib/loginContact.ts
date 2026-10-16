import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { ROBLOX_USERNAME_PATTERN } from './roblox';

export { getCountries, getCountryCallingCode, type CountryCode };

export const ASEAN_PHONE_COUNTRIES: readonly CountryCode[] = ['ID', 'MY', 'PH', 'SG', 'TH', 'VN', 'BN', 'KH', 'LA', 'MM', 'TL'];

/** Numbering-plan validation does not verify ownership or WhatsApp activation. */
export function normalizeWhatsapp(value: unknown, country?: CountryCode): string | null {
  if (typeof value !== 'string' || value.length > 64 || !/^[+\d\s().-]+$/.test(value) || (!country && !value.trim().startsWith('+'))) return null;
  const phone = parsePhoneNumberFromString(value.trim(), { defaultCountry: country, extract: false });
  return phone && !phone.ext && phone.isValid() ? phone.number : null;
}

export type LoginAccount = { username: string; email: string; whatsapp: string; country: CountryCode | '' };
export function validateLoginAccount(account: LoginAccount) {
  return {
    username: !ROBLOX_USERNAME_PATTERN.test(account.username.trim()),
    email: account.email.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim()),
    whatsapp: !account.country || !normalizeWhatsapp(account.whatsapp, account.country || undefined),
  };
}

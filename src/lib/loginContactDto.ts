import { decryptData } from './crypto';

/** Never expose the encrypted field, even to an authenticated non-owner. */
export function loginContactDto<T extends { method: string; whatsappE164: string | null }>(detail: T | null, allowed: boolean) {
  if (!detail) return { robloxDetail: null, contactWhatsapp: null };
  const { whatsappE164, ...robloxDetail } = detail;
  return { robloxDetail, contactWhatsapp: allowed && detail.method === 'LOGIN' && whatsappE164 ? decryptData(whatsappE164) : null };
}

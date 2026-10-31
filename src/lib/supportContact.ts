const SUPPORT_WHATSAPP_URL = 'https://wa.me/6287867395872';

export function supportContactUrl(message: string) {
  return `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}

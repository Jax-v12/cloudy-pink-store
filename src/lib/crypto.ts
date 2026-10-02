import crypto from 'crypto';

function secretKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret?.trim()) throw new Error('ENCRYPTION_KEY_REQUIRED');
  return crypto.createHash('sha256').update(secret).digest();
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Mengenkripsi teks mentah (email & password) menjadi format: IV:TAG:ENCRYPTED_DATA
 */
export function encryptData(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey(), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Gabungkan iv, tag, dan ciphertext dengan pemisah ':'
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Mengembalikan teks acak menjadi email & password aslinya
 */
export function decryptData(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3 || !/^[a-f\d]{32}$/i.test(parts[0]) || !/^[a-f\d]{32}$/i.test(parts[1]) || !/^(?:[a-f\d]{2})*$/i.test(parts[2])) {
    throw new Error('Format data terenkripsi tidak valid');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, secretKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Legacy email/PIN/notes were plaintext. Passwords must always use decryptData.
// Authenticated decryption failures must never fall back to ciphertext as plaintext.
export function decryptLegacyField(value: string): string {
  return /^[a-f\d]{32}:/i.test(value) ? decryptData(value) : value;
}

import crypto from 'crypto';

const secret = process.env.ENCRYPTION_KEY;
if (!secret || !secret.trim()) {
  throw new Error('ENCRYPTION_KEY_REQUIRED');
}

// Kunci enkripsi diambil dari .env dan di-hash jadi 32 byte pasti
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(secret)
  .digest();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Mengenkripsi teks mentah (email & password) menjadi format: IV:TAG:ENCRYPTED_DATA
 */
export function encryptData(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

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
  if (parts.length !== 3) {
    throw new Error('Format data terenkripsi tidak valid');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
export const LOGIN_BACKUP_CODE_COUNT = 5;
export const LOGIN_ACCESS_TTL_MS = 72 * 60 * 60 * 1000;
export type LoginCredentials = { password: string; backupCodes: string[] };

export function validLoginPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 1024 && value.trim().length > 0 && !value.includes('\0');
}

/** Validate shape only; Roblox, not the store, determines whether a code is usable. */
export function normalizeLoginBackupCodes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length !== LOGIN_BACKUP_CODE_COUNT ||
      !value.every((code): code is string => typeof code === 'string' && code.length <= 64 && code.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(code))) return null;
  const codes = value.map(code => code.trim());
  return new Set(codes).size === LOGIN_BACKUP_CODE_COUNT ? codes : null;
}

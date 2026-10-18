import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  OTP_REQUEST_ACTION,
  OTP_TTL_MS,
  validateOtpCode,
  encodeOtpReplyAction,
  resolveAppsOtpState,
  buildAppsOtpWhatsappUrl,
} from '../src/lib/appsOtp.ts';

describe('appsOtp', () => {
  before(() => {
    process.env.ENCRYPTION_KEY ||= 'test-encryption-key-32-bytes-minimum';
  });

  it('validates OTP / Household codes strictly', () => {
    assert.equal(validateOtpCode(' 482910 '), '482910');
    assert.equal(validateOtpCode('NF-1234 56'), 'NF-1234 56');
    assert.equal(validateOtpCode('12'), null);
    assert.equal(validateOtpCode('a'.repeat(25)), null);
    assert.equal(validateOtpCode('1234\n56'), null);
    assert.equal(validateOtpCode(123456), null);
  });

  it('encodes encrypted OTP reply under VARCHAR(191) and resolves state transitions', () => {
    const t0 = new Date('2026-10-18T10:00:00.000Z');
    const t1 = new Date('2026-10-18T10:01:00.000Z');
    const replyAction = encodeOtpReplyAction('849201');
    assert.equal(replyAction.length <= 191, true);
    assert.equal(replyAction.includes('849201'), false);

    // 1. IDLE when no audits
    assert.deepEqual(resolveAppsOtpState([], true, t0.getTime()), {
      status: 'IDLE',
      code: null,
      updatedAt: null,
      expiresAt: null,
    });

    // 2. REQUESTED when customer requested within TTL
    const requested = resolveAppsOtpState(
      [{ action: OTP_REQUEST_ACTION, createdAt: t0 }],
      true,
      t0.getTime() + 30_000,
    );
    assert.equal(requested.status, 'REQUESTED');
    assert.equal(requested.code, null);

    // 3. DELIVERED when admin replied after request (customer view includes decrypted code)
    const deliveredCustomer = resolveAppsOtpState(
      [
        { action: replyAction, createdAt: t1 },
        { action: OTP_REQUEST_ACTION, createdAt: t0 },
      ],
      true,
      t1.getTime() + 10_000,
    );
    assert.equal(deliveredCustomer.status, 'DELIVERED');
    assert.equal(deliveredCustomer.code, '849201');

    // 4. Admin list view omits decrypted plaintext code
    const deliveredAdminList = resolveAppsOtpState(
      [{ action: replyAction, createdAt: t1 }],
      false,
      t1.getTime() + 10_000,
    );
    assert.equal(deliveredAdminList.status, 'DELIVERED');
    assert.equal(deliveredAdminList.code, null);

    // 5. Expires back to IDLE after OTP_TTL_MS (15 minutes)
    const expired = resolveAppsOtpState(
      [{ action: replyAction, createdAt: t1 }],
      true,
      t1.getTime() + OTP_TTL_MS + 1,
    );
    assert.equal(expired.status, 'IDLE');
    assert.equal(expired.code, null);
  });

  it('builds pre-formatted WhatsApp URL with invoice and profile without credentials', () => {
    const url = buildAppsOtpWhatsappUrl(
      '6287867395872',
      'INV-998877',
      'Netflix Premium 1 Bulan',
      'Profil 2',
      'Halo Admin, saya butuh kode OTP untuk {product} dengan Invoice: {invoice}',
    );
    assert.equal(url.startsWith('https://wa.me/6287867395872?text='), true);
    const decoded = decodeURIComponent(url.split('?text=')[1]);
    assert.equal(
      decoded,
      'Halo Admin, saya butuh kode OTP untuk Netflix Premium 1 Bulan (Profil 2) dengan Invoice: INV-998877',
    );
  });
});

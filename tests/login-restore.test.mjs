import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreTarget } from '../scripts/purge-restored-login-secrets.mjs';

test('restore purge refuses remote, defaultdb, ambiguous targets and online application access', () => {
  const allowed = { RESTORE_DATABASE_URL: 'mysql://root@127.0.0.1:3306/cloudy_test_restore', RESTORE_APPLICATION_DISABLED: 'true' };
  assert.equal(restoreTarget(allowed), allowed.RESTORE_DATABASE_URL);
  for (const target of ['mysql://root@remote.aivencloud.com/cloudy_staging','mysql://root@127.0.0.1/defaultdb','mysql://root@127.0.0.1/cloudy_test_restore?database=defaultdb','mysql://root@127.0.0.1/cloudy_test_restore#fragment']) assert.throws(() => restoreTarget({ ...allowed, RESTORE_DATABASE_URL: target }), /RESTORE_TARGET_REJECTED/);
  assert.throws(() => restoreTarget({ ...allowed, RESTORE_APPLICATION_DISABLED: 'false' }), /RESTORE_TARGET_REJECTED/);
  assert.throws(() => restoreTarget({ ...allowed, NODE_ENV: 'production' }), /RESTORE_TARGET_REJECTED/);
});

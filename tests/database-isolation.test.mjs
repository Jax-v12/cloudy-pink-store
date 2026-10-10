import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

test('database isolation protects against remote database access', () => {
  // Test 1: TEST_DATABASE_URL points to a remote database -> should exit with code 1
  try {
    execSync('node --import ./tests/register.mjs -e "console.log(process.env.DATABASE_URL)"', {
      env: { ...process.env, TEST_DATABASE_URL: 'mysql://remote:3306/cloudy_test_general' },
      stdio: 'pipe'
    });
    assert.fail('Should have exited with error');
  } catch (e) {
    assert.ok(e.stderr.toString().includes('FATAL: Test environment variable TEST_DATABASE_URL violates isolation'));
  }

  // Test 2: TEST_DATABASE_URL points to non-cloudy_test name -> should exit with code 1
  try {
    execSync('node --import ./tests/register.mjs -e "console.log(process.env.DATABASE_URL)"', {
      env: { ...process.env, TEST_DATABASE_URL: 'mysql://127.0.0.1:3306/defaultdb' },
      stdio: 'pipe'
    });
    assert.fail('Should have exited with error');
  } catch (e) {
    assert.ok(e.stderr.toString().includes('FATAL: Test environment variable TEST_DATABASE_URL violates isolation'));
  }

  // Test 3: DATABASE_URL points to a remote database (e.g. Aiven) and no TEST_DATABASE_URL is set -> should be overwritten to dummy
  const out = execSync('node --import ./tests/register.mjs -e "console.log(process.env.DATABASE_URL)"', {
    env: { ...process.env, DATABASE_URL: 'mysql://remote:3306/defaultdb', TEST_DATABASE_URL: '' },
    stdio: 'pipe'
  });
  assert.equal(out.toString().trim(), 'mysql://root@127.0.0.1:0/cloudy_test_blocked_by_isolation');
});

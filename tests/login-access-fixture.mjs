// Deliberately synthetic. Never use a real Roblox password or backup code in tests.
export function loginCredentialsFixture() {
  return { password: 'fixture-password-only', backupCodes: ['fixture-01', 'fixture-02', 'fixture-03', 'fixture-04', 'fixture-05'] };
}

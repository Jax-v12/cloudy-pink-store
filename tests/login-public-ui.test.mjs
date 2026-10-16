import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ASEAN_PHONE_COUNTRIES, getCountries, getCountryCallingCode } from '../src/lib/loginContact.ts';
import { loginFlowTranslations } from '../src/lib/loginFlowTranslations.ts';

test('ASEAN phone choices are complete, unique, supported and served by inert local flags', () => {
  assert.deepEqual(ASEAN_PHONE_COUNTRIES, ['ID', 'MY', 'PH', 'SG', 'TH', 'VN', 'BN', 'KH', 'LA', 'MM', 'TL']);
  assert.equal(new Set(ASEAN_PHONE_COUNTRIES).size, 11);
  assert.equal(getCountryCallingCode(ASEAN_PHONE_COUNTRIES[0]), '62');
  for (const country of ASEAN_PHONE_COUNTRIES) {
    assert.ok(getCountries().includes(country));
    const svg = fs.readFileSync(new URL(`../public/flags/${country.toLowerCase()}.svg`, import.meta.url), 'utf8');
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<\s*(?:script|foreignObject|iframe)|\bon\w+\s*=|(?:href|src)\s*=\s*['"](?:https?:|\/\/|javascript:|data:)|<!ENTITY|<!DOCTYPE/i);
  }
});

test('public username lookup and country group states are translated in all three locales', () => {
  for (const locale of ['ID', 'EN', 'MY']) for (const key of ['checkUsername', 'usernameChecking', 'robloxUserId', 'usernameMissing', 'usernameRateLimit', 'usernameTimeout', 'usernameUnavailable', 'aseanCountries', 'otherCountries']) {
    assert.equal(typeof loginFlowTranslations[locale][key], 'string');
    assert.ok(loginFlowTranslations[locale][key].trim());
  }
});

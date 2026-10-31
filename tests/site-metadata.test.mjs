import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSiteOrigin, publicPageMetadata } from '../src/lib/siteMetadata.ts';
import sitemap from '../src/app/sitemap.ts';
import robots from '../src/app/robots.ts';

function withEnvironment(values, run) {
  const keys = ['APP_ORIGIN', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, values);
    return run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('Production metadata uses the platform production domain when APP_ORIGIN is absent', () => {
  withEnvironment({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'store.example.test', VERCEL_URL: 'deployment.example.test' }, () => {
    assert.equal(publicSiteOrigin(), 'https://store.example.test');
    assert.deepEqual(sitemap().map(row => row.url), ['/', '/apps', '/roblox', '/help', '/privacy'].map(path => 'https://store.example.test' + path));
    assert.equal(robots().sitemap, 'https://store.example.test/sitemap.xml');
    assert.deepEqual(robots().rules.disallow, ['/admin', '/order', '/api']);
  });
});

test('an empty APP_ORIGIN also uses the platform production domain', () => {
  withEnvironment({ APP_ORIGIN: '', VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'store.example.test' }, () => {
    assert.equal(publicSiteOrigin(), 'https://store.example.test');
    assert.equal(sitemap().length, 5);
  });
});

test('an explicit canonical origin wins and invalid explicit origins fail closed', () => {
  withEnvironment({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'store.example.test' }, () => {
    assert.equal(publicSiteOrigin('https://custom.example.test/'), 'https://custom.example.test');
    for (const value of ['http://store.example.test', 'https://user:pass@store.example.test', 'https://store.example.test/?token=synthetic', 'https://store.example.test/private']) {
      assert.equal(publicSiteOrigin(value), null);
    }
  });
});

test('platform metadata fallback rejects credentials, ports, paths and local addresses', () => {
  for (const host of ['user:pass@store.example.test', 'store.example.test:444', 'store.example.test/private', 'store.example.test?token=synthetic', 'localhost', 'store.localhost', '127.0.0.1', '[::1]']) {
    withEnvironment({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: host }, () => assert.equal(publicSiteOrigin(), null, host));
  }
});

test('public share cards use the current page title, description and canonical origin', () => {
  withEnvironment({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'store.example.test' }, () => {
    const metadata = publicPageMetadata('Privacy | Store', 'Privacy and order access');
    assert.equal(metadata.metadataBase.origin, 'https://store.example.test');
    assert.equal(metadata.openGraph.title, metadata.title);
    assert.equal(metadata.openGraph.description, metadata.description);
    assert.equal(metadata.twitter.card, 'summary_large_image');
    assert.equal(metadata.openGraph.images[0].url, '/banner-logo.png');
  });
  withEnvironment({}, () => {
    const metadata = publicPageMetadata('Store', 'Description');
    assert.equal(metadata.metadataBase, undefined);
    assert.equal(metadata.openGraph, undefined);
  });
});

test('Preview never advertises a sitemap or allows indexing with a production domain configured', () => {
  withEnvironment({ VERCEL_ENV: 'preview', VERCEL_PROJECT_PRODUCTION_URL: 'store.example.test', APP_ORIGIN: 'https://store.example.test' }, () => {
    assert.deepEqual(sitemap(), []);
    assert.deepEqual(robots().rules, { userAgent: '*', disallow: '/' });
    assert.equal(robots().sitemap, undefined);
  });
});

test('local or unconfigured builds never invent a public origin from deployment URLs', () => {
  withEnvironment({ VERCEL_PROJECT_PRODUCTION_URL: 'store.example.test', VERCEL_URL: 'deployment.example.test' }, () => {
    assert.equal(publicSiteOrigin(), null);
    assert.deepEqual(sitemap(), []);
    assert.equal(robots().sitemap, undefined);
  });
});

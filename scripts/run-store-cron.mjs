import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { isIP } from 'node:net';

/** Only operator-provided configuration is accepted; never log headers or responses. */
export async function runStoreCron(env = process.env, request = fetch, wait = setTimeout) {
  let origin;
  try { origin = new URL(env.STORE_CRON_ORIGIN); } catch { throw new Error('CRON_CONFIG_INVALID'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash ||
      origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost') || isIP(origin.hostname.replace(/^\[|\]$/g, '')) ||
      !env.CRON_SECRET || /[\r\n]/.test(env.CRON_SECRET) || /[\r\n]/.test(env.VERCEL_AUTOMATION_BYPASS_SECRET || '')) throw new Error('CRON_CONFIG_INVALID');
  const headers = { Authorization: `Bearer ${env.CRON_SECRET}` };
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  let failed = false;
  for (const path of ['/api/cron/cleanup', '/api/cron/fulfillment']) {
    let succeeded = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      let retry = false;
      try {
        const response = await request(new URL(path, origin), { method: 'GET', headers, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(20_000) });
        if (response.ok) {
          try { succeeded = (await response.json()).success === true; } catch { /* A login/error page is not cron success. */ }
        } else {
          retry = response.status === 429 || response.status >= 500;
          await response.body?.cancel();
        }
      } catch { retry = true; }
      if (succeeded || !retry) break;
      if (attempt < 2) await wait(1000 * (attempt + 1));
    }
    if (!succeeded) failed = true;
  }
  if (failed) throw new Error('CRON_RUN_FAILED');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runStoreCron(); console.log('STORE_CRON_OK'); }
  catch (error) { console.error(error?.message === 'CRON_CONFIG_INVALID' ? 'CRON_CONFIG_INVALID' : 'CRON_RUN_FAILED'); process.exitCode = 1; }
}

/** Proxy only read-only renderer traffic; checkout/auth APIs stay in their fixtures. */
export async function fulfillFixtureRead(route, server) {
  const request = route.request(), url = new URL(request.url()), target = new URL(server);
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      target.username || target.password || target.pathname !== '/' || target.search || target.hash ||
      !['GET', 'HEAD'].includes(request.method()) || /^\/api(?:\/|$)/.test(url.pathname)) {
    throw new Error('UNSAFE_FIXTURE_PROXY_REQUEST');
  }
  // Playwright retries ECONNRESET only; never retry API/mutation traffic or HTTP failures.
  const response = await route.fetch({ url: target.origin + url.pathname + url.search, maxRedirects: 0, maxRetries: 1 });
  try { return await route.fulfill({ response }); }
  catch (error) {
    // Navigation can cancel a prefetched read after its response was fetched.
    if (error instanceof Error && error.message.includes('Route is already handled!') && route.request().failure?.()?.errorText === 'net::ERR_ABORTED') return;
    throw error;
  }
}

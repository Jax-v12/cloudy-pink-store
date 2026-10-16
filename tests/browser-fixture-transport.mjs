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
  return route.fulfill({ response });
}

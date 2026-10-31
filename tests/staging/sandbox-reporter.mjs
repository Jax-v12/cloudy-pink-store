export default async function* reporter(source) {
  for await (const event of source) {
    if (['test:pass', 'test:fail'].includes(event.type)) {
      const name = /^sandbox: [A-Za-z0-9 ,_/+()#.-]+$/.test(event.data.name) ? event.data.name : 'sandbox suite';
      const error = event.data.details?.error;
      const code = [error?.code, error?.cause?.code, error?.actual?.code].find(value => typeof value === 'string' && /^(?:P\d{4}|ERR_ASSERTION|ERR_TEST_FAILURE|(?:SANDBOX|STAGING)_[A-Z_]+)$/.test(value));
      const reason = typeof event.data.skip === 'string' && /^SANDBOX_[A-Z_]+$/.test(event.data.skip) ? event.data.skip : undefined;
      yield JSON.stringify({
        test: name,
        result: event.data.skip ? 'SKIP' : event.type === 'test:pass' ? 'PASS' : 'FAIL',
        ...(code ? { code } : {}),
        ...(reason ? { reason } : {}),
      }) + '\n';
    }
    if (event.type === 'test:summary') yield JSON.stringify({ summary: event.data.counts }) + '\n';
  }
}

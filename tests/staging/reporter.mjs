// Assertion values and Prisma errors can contain private data. Emit names/counts only.
export default async function* reporter(source) {
  for await (const event of source) {
    if (['test:pass', 'test:fail'].includes(event.type)) {
      const name = /^staging: [A-Za-z0-9 ,_/+()-]+$/.test(event.data.name) ? event.data.name : 'staging suite';
      const error = event.data.details?.error;
      const errorCode = [error?.code, error?.cause?.code, error?.actual?.code].find(value => typeof value === 'string' && /^(?:P\d{4}|ERR_ASSERTION|ERR_TEST_FAILURE|STAGING_[A-Z_]+)$/.test(value));
      yield JSON.stringify({ test: name, result: event.data.skip ? 'SKIP' : event.type === 'test:pass' ? 'PASS' : 'FAIL', ...(event.type === 'test:fail' && errorCode ? { errorCode } : {}) }) + '\n';
    }
    if (event.type === 'test:summary') yield JSON.stringify({ summary: event.data.counts }) + '\n';
  }
}

export default async function* reporter(source) {
  for await (const event of source) {
    if (['test:pass', 'test:fail'].includes(event.type)) {
      const name = event.data.name;
      const error = event.data.details?.error;
      const code = [error?.code, error?.cause?.code, error?.actual?.code].find(value => typeof value === 'string');
      yield JSON.stringify({
        test: name,
        result: event.data.skip ? 'SKIP' : event.type === 'test:pass' ? 'PASS' : 'FAIL',
        code: code || error?.message,
        message: error?.message,
      }) + '\n';
    }
    if (event.type === 'test:summary') yield JSON.stringify({ summary: event.data.counts }) + '\n';
  }
}

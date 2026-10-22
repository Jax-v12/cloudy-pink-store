export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.info('STORE_NODE_RUNTIME', process.version);
  }
}

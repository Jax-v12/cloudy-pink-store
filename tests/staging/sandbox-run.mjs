import { spawn } from 'node:child_process';
import { writeApproval, isolatedEnvironment, workerArguments } from './sandbox-policy.mjs';

try {
  const [mode = 'preflight', ...args] = process.argv.slice(2);
  const runId = args.find(arg => arg.startsWith('--run-id='))?.slice('--run-id='.length);
  const approval = args.find(arg => arg.startsWith('--allow-fixture-writes='))?.slice('--allow-fixture-writes='.length);
  const cases = args.filter(arg => arg.startsWith('--case=')).map(arg => arg.slice('--case='.length));
  if (mode !== 'preflight' && mode !== 'run') throw new Error('SANDBOX_MODE_REJECTED');
  if (args.some(arg => !arg.startsWith('--run-id=') && !arg.startsWith('--allow-fixture-writes=') && !arg.startsWith('--case='))) throw new Error('SANDBOX_ARGUMENT_REJECTED');
  if (mode === 'run') writeApproval(runId, approval);
  const workerArgs = workerArguments(cases);
  const { loadTarget, realClient, preflight, root } = await import('./sandbox-runtime.mjs');
  const url = await loadTarget();
  if (mode === 'preflight') {
    const raw = realClient(url);
    try { console.log(JSON.stringify({ mode: 'READ_ONLY', ...await preflight(raw), fixtureWrites: 0 })); }
    finally { await raw.$disconnect(); }
  } else {
    const env = isolatedEnvironment(process.env);
    Object.assign(env, { DATABASE_URL: url, STAGING_RUN_ID: runId, STAGING_WRITE_APPROVAL: approval, NODE_ENV: 'test', CHECKPOINT_DISABLE: '1' });
    const child = spawn(process.execPath, workerArgs, { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(process.stdout);
    let stderrChunks = [];
    child.stderr.on('data', chunk => { stderrChunks.push(chunk); });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    if (stderrChunks.length) {
      const errStr = Buffer.concat(stderrChunks).toString();
      const sanitized = errStr.replace(/mysql:[^@]+@/g, 'mysql://***@').replace(/Basic\s+[A-Za-z0-9+/=]+/g, 'Basic ***');
      console.error(sanitized);
    }
    process.exitCode = code === 0 ? 0 : 1;
  }
} catch (error) {
  const code = /^(?:STAGING|SANDBOX)_[A-Z_]+$/.test(error.message) ? error.message : /certificate|self.signed|issuer/i.test(error.message) ? 'STAGING_TLS_CERTIFICATE_UNTRUSTED' : 'SANDBOX_CHECK_FAILED_DETAILS_WITHHELD';
  console.log(JSON.stringify({ result: 'BLOCKED', code, rawMessage: error.message })); process.exitCode = 1;
}

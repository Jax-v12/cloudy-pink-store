import { registerHooks } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');

// Fail-closed database isolation protection.
// Runs before any modules (including Prisma) are evaluated.
for (const key of Object.keys(process.env)) {
  if (key.endsWith('DATABASE_URL') && process.env[key]) {
    try {
      const parsed = new URL(process.env[key]);
      const validHost = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
      const validName = /^\/cloudy_test_[a-z0-9_]+$/.test(parsed.pathname);
      if (!validHost || !validName) {
        if (key === 'DATABASE_URL') {
          process.env[key] = 'mysql://root@127.0.0.1:0/cloudy_test_blocked_by_isolation';
        } else {
          console.error(`FATAL: Test environment variable ${key} violates isolation (${parsed.hostname}${parsed.pathname})!`);
          process.exit(1);
        }
      }
    } catch { /* invalid url parsing is ignored unless it's one we just threw */ }
  }
}
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(root, 'src', specifier.slice(2))).href;
    if (specifier === 'next/server' || specifier === 'next/headers') specifier += '.js';
    if (specifier.startsWith('.') || specifier.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL || pathToFileURL(root + '/'));
      if (!path.extname(url.pathname) && fs.existsSync(fileURLToPath(url) + '.ts')) specifier = url.href + '.ts';
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts') && !url.includes('/node_modules/')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(fs.readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText,
    };
    return next(url, context);
  },
});

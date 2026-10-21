import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// Resolve through the actual consumers: these are transitive dependencies,
// not extra top-level copies that could leave the production path unpatched.
const require = createRequire(import.meta.url);
const proxyRequire = createRequire(require.resolve('http-proxy-middleware'));
const micromatchPath = proxyRequire.resolve('micromatch');
const micromatch = proxyRequire('micromatch');
const braces = createRequire(micromatchPath)('braces');
const sandboxRequire = createRequire(new URL('../../mockup-sandbox/package.json', import.meta.url));
const glob = sandboxRequire('fast-glob');
const globRequire = createRequire(sandboxRequire.resolve('fast-glob'));
const globBraces = createRequire(globRequire.resolve('micromatch'))('braces');
const typographyRequire = createRequire(require.resolve('@tailwindcss/typography'));

describe('Dependency security regressions', () => {
  it('rejects deeply nested strings before any recursive AST walker overflows', () => {
    const patterns = [
      '{'.repeat(4000) + 'a,b' + '}'.repeat(4000),
      '('.repeat(4000) + 'a' + ')'.repeat(4000),
      '{('.repeat(2000) + 'a,b' + ')}'.repeat(2000),
      '{'.repeat(4000) + 'a,b',
    ];
    for (const implementation of [braces, globBraces]) {
      for (const pattern of patterns) {
        for (const operation of [
          implementation, implementation.create, implementation.parse,
          implementation.compile, implementation.expand, implementation.stringify,
        ]) {
          assert.throws(() => operation(pattern), {
            name: 'SyntaxError',
            message: /maximum nesting depth/,
          });
        }
      }
    }
  });

  it('also bounds recursive walkers when callers supply an AST directly', () => {
    for (const operation of [braces.compile, braces.expand, braces.stringify]) {
      let ast: object = { type: 'text', value: 'a' };
      for (let depth = 0; depth < 5000; depth++) {
        ast = { type: 'root', nodes: [ast] };
      }
      assert.throws(() => operation(ast), {
        name: 'SyntaxError',
        message: /maximum nesting depth/,
      });
    }
  });

  it('preserves ordinary brace expansion, ranges, nesting and escaped literals', () => {
    assert.deepEqual(braces.expand('src/{pages,components}/*.{ts,tsx}'), [
      'src/pages/*.ts', 'src/pages/*.tsx',
      'src/components/*.ts', 'src/components/*.tsx',
    ]);
    assert.deepEqual(braces.expand('{1..3}'), ['1', '2', '3']);
    assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
    assert.equal(braces.stringify(braces.parse('src/{a,b}')), 'src/{a,b}');
    assert.equal(braces.compile('{a,b}'), '(a|b)');
    assert.deepEqual(braces.expand('\\{a,b\\}'), ['{a,b}']);
    const nested = '('.repeat(64) + 'a' + ')'.repeat(64);
    assert.equal(braces.compile(nested), nested);
  });

  it('preserves proxy path matching and sandbox file discovery', () => {
    assert.deepEqual(micromatch(['/api/clerk/session', '/assets/main.js'], '/api/{clerk,auth}/**'), [
      '/api/clerk/session',
    ]);
    const cwd = mkdtempSync(join(tmpdir(), 'dependency-glob-'));
    try {
      mkdirSync(join(cwd, 'nested'));
      for (const file of ['a.ts', 'b.tsx', 'c.css', 'nested/d.tsx']) {
        writeFileSync(join(cwd, file), '');
      }
      assert.deepEqual(glob.sync('**/*.{ts,tsx}', { cwd }).sort(), [
        'a.ts', 'b.tsx', 'nested/d.tsx',
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('parses a large flat selector without quadratic CPU exhaustion', () => {
    const parserPath = typographyRequire.resolve('postcss-selector-parser');
    // A separate process enforces a wall-clock deadline even if the synchronous
    // parser regresses and blocks its event loop.
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict');
      const parser = require(${JSON.stringify(parserPath)});
      const selector = '.a'.repeat(200000);
      assert.equal(parser().processSync(selector), selector);
      assert.equal(parser().processSync('a > .b:is(#c, [data-x="y"])'),
        'a > .b:is(#c, [data-x="y"])');
    `], { timeout: 5000, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  });
});

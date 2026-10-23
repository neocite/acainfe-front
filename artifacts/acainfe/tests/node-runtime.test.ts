import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { assertSecureNodeVersion } from '../scripts/check-node.mjs';

describe('Runtime corrigido para as falhas de outubro de 2026', () => {
  it('aceita os primeiros releases corrigidos e atualizações posteriores nas mesmas linhas', () => {
    for (const version of ['22.23.4', '22.23.5', '22.24.0', '24.22.1', '24.23.0', '26.12.1', '26.13.0', 'v22.23.4']) {
      assert.doesNotThrow(() => assertSecureNodeVersion(version), version);
    }
  });
  it('recusa releases vulneráveis, linhas sem suporte, prereleases e versões desconhecidas', () => {
    for (const version of ['20.99.99', '22.23.3', '22.22.99', '23.99.99', '24.22.0', '24.21.99',
      '25.99.99', '26.12.0', '26.11.99', '27.0.0', '22.23.4-rc.1', 'invalid']) {
      assert.throws(() => assertSecureNodeVersion(version), /atualização de segurança/, version);
    }
  });
  it('valida e registra o runtime efetivo sem expor configurações ou credenciais', () => {
    const output = execFileSync(process.execPath, ['scripts/check-node.mjs'], { encoding: 'utf8' });
    assert.equal(output.trim(), `[runtime] Node.js ${process.version}; atualização de segurança de 21/10/2026 verificada.`);
  });
  it('impede build e inicialização dev/produção sem executar a verificação antes', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    for (const name of ['dev', 'build', 'serve', 'start', 'test']) {
      assert.ok(pkg.scripts[name].startsWith('node scripts/check-node.mjs && '), name);
    }
    assert.equal(pkg.engines.node, '^22.23.4 || ^24.22.1 || ^26.12.1');
    assert.match(readFileSync('../../.replit', 'utf8'), /modules = \["nodejs-22"/);
    const production = readFileSync('.replit-artifact/artifact.toml', 'utf8').split('[services.production]')[1].split('[services.env]')[0];
    assert.match(production, /run = .*"run", "start"/);
    assert.match(production, /build = .*"run", "build"/);
  });
});

import { it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { hermesMcpCommand } from '../src/lib/hermes-mcp';

it('gera comando oficial com URL dinâmica e autenticação interativa, sem token', () => {
  assert.equal(hermesMcpCommand('https://example.test/mcp'), "hermes mcp add acainfe --url 'https://example.test/mcp' --auth header");
  assert.doesNotMatch(hermesMcpCommand('https://example.test/mcp'), /--header |Bearer|apiKey/);
});
it('protege caracteres especiais da URL ao colar no Bash', () => {
  const url = "https://example.test/mcp?q='&literal=$(printf BAD)`printf BAD`";
  const command = hermesMcpCommand(url);
  // Substitui apenas o executável por uma função local: não executa Hermes nem acessa a rede.
  const result = execFileSync('bash', ['-c', `hermes() { printf '%s\\n' "$@"; }; ${command}`], { encoding: 'utf8' });
  assert.deepEqual(result.trimEnd().split('\n'), ['mcp', 'add', 'acainfe', '--url', url, '--auth', 'header']);
});

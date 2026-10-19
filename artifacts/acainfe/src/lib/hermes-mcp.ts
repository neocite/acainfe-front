/** CLI oficial: https://hermes-agent.nousresearch.com/docs/reference/cli-commands */
export function hermesMcpCommand(mcpUrl: string): string {
  // Aspas simples POSIX impedem expansão de $, crases e outros caracteres da URL.
  const quotedUrl = `'${mcpUrl.replaceAll("'", "'\\''")}'`;
  return `hermes mcp add acainfe --url ${quotedUrl} --auth header`;
}

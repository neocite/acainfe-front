import { api, ApiError } from './api';

export type McpKeyItem = {
  id: string;
  label?: string | null;
  last4?: string | null;
  createdAt?: string | null;
  createdVia?: 'APP' | 'API' | 'ADMIN';
  lastUsedAt?: string | null;
  legacy: boolean;
};
export type GeneratedMcpKey = {
  apiKey: string;
  mcpUrl: string;
  claudeCodeCommand: string;
  key?: McpKeyItem;
};

export async function listMcpKeys(base: string): Promise<McpKeyItem[]> {
  const result = await api<{ items: McpKeyItem[] }>(`${base}/mcp-keys`);
  if (!Array.isArray(result.items) || result.items.some(item =>
    !item || typeof item.id !== 'string' || !item.id ||
    typeof item.legacy !== 'boolean' ||
    (item.label != null && typeof item.label !== 'string') ||
    (item.last4 != null && typeof item.last4 !== 'string') ||
    (item.createdAt != null && typeof item.createdAt !== 'string') ||
    (item.lastUsedAt != null && typeof item.lastUsedAt !== 'string')
  )) throw new Error('Não foi possível ler a lista de chaves do MCP.');
  return result.items;
}

export async function createMcpKey(base: string, label: string): Promise<GeneratedMcpKey> {
  const name = label.trim();
  if (name.length > 60) throw new Error('O nome da chave deve ter no máximo 60 caracteres.');
  try {
    return await api<GeneratedMcpKey>(`${base}/mcp-key`, 'POST', name ? { label: name } : {});
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new ApiError(409, `${error.message} Revogue uma chave antiga em “Chaves do MCP” para gerar outra.`, error.details);
    }
    throw error;
  }
}

export function revokeMcpKey(base: string, id: string): Promise<{ revoked: boolean | number; remaining: number }> {
  return api(`${base}/mcp-keys/${encodeURIComponent(id)}`, 'DELETE');
}
export function revokeAllMcpKeys(base: string): Promise<{ revoked: number }> {
  return api(`${base}/mcp-keys`, 'DELETE');
}

export function appUpstreamPath(originalUrl: string): string {
  return originalUrl.replace(/^\/api\/app(?=\/|$|\?)/, '/v1/app');
}

export function appJsonBody(method: string, payload: unknown): string | undefined {
  if (['GET', 'HEAD', 'DELETE'].includes(method.toUpperCase())) return undefined;
  return JSON.stringify(payload);
}

const appRoutes = [
  ['GET', /^\/me$/], ['PUT', /^\/me$/],
  ['POST', /^\/onboarding\/certificate$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+$/], ['PATCH', /^\/companies\/[a-zA-Z0-9_-]+$/],
  ['PUT', /^\/companies\/[a-zA-Z0-9_-]+\/accountant$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/(?:abacatepay|mcp-key|billing\/payments)$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+\/(?:products|billing|past-sales|past-sales\/items)$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/past-sales\/(?:scan|mark|issue)$/],
] as const;

export function isAllowedAppRoute(method: string, path: string): boolean {
  return appRoutes.some(([verb, pattern]) => verb === method && pattern.test(path));
}

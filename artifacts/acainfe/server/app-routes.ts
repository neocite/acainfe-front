const appRoutes = [
  ['GET', /^\/me$/], ['PUT', /^\/me$/],
  ['GET', /^\/fiscal-profiles$/],
  ['POST', /^\/onboarding\/certificate$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+$/], ['PATCH', /^\/companies\/[a-zA-Z0-9_-]+$/],
  ['PUT', /^\/companies\/[a-zA-Z0-9_-]+\/accountant$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+\/fiscal-settings$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/fiscal-settings\/send$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/(?:abacatepay|mcp-key|billing\/payments)$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+\/mcp-keys$/],
  ['DELETE', /^\/companies\/[a-zA-Z0-9_-]+\/mcp-keys(?:\/[a-zA-Z0-9_-]+)?$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+\/past-sales\/reconcile$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/past-sales\/reconcile\/apply$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+\/(?:products|billing|past-sales|past-sales\/items)$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/past-sales\/(?:scan|mark|issue)$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/products$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/products\/[a-zA-Z0-9_-]+\/confirm-tax$/],
] as const;

export function isAllowedAppRoute(method: string, path: string): boolean {
  return appRoutes.some(([verb, pattern]) => verb === method && pattern.test(path));
}

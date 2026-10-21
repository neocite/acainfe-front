export const INSTITUTIONAL_ROUTES = { about: '/sobre', contact: '/contato', privacy: '/privacidade', developers: '/developers' } as const;
export const PUBLIC_PAGE_ALIASES: Record<string, string> = { '/about': '/sobre', '/contact': '/contato', '/privacy': '/privacidade' };
export function publicCanonicalPath(path: string) {
  const normalized = path.replace(/\/+$/, '') || '/';
  return PUBLIC_PAGE_ALIASES[normalized] ?? normalized;
}
export const publicCanonicalUrl = (path: string) => `https://acainfe.com${publicCanonicalPath(path)}`;
/** Shared by the browser router and HTTP status resolver. */
export const SITE_ROUTES = {
  home: '/', signIn: '/sign-in/*?', signUp: '/sign-up/*?',
  app: '/app', account: '/app/conta', onboarding: '/onboarding',
  ...INSTITUTIONAL_ROUTES,
} as const;
export const SITEMAP_PATHS = ['/', ...Object.values(INSTITUTIONAL_ROUTES), '/llms.txt'] as const;

export function isValidPage(path: string) {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return Object.hasOwn(PUBLIC_PAGE_ALIASES, normalized) || Object.values(SITE_ROUTES).some(route => route.endsWith('/*?')
    ? normalized === route.slice(0, -3) || normalized.startsWith(route.slice(0, -2))
    : route === normalized);
}

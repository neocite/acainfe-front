export const INSTITUTIONAL_ROUTES = { about: '/sobre', contact: '/contato', privacy: '/privacidade' } as const;
/** Shared by the browser router and HTTP status resolver. */
export const SITE_ROUTES = {
  home: '/', signIn: '/sign-in/*?', signUp: '/sign-up/*?',
  app: '/app', account: '/app/conta', onboarding: '/onboarding',
  ...INSTITUTIONAL_ROUTES,
} as const;
export const SITEMAP_PATHS = ['/', ...Object.values(INSTITUTIONAL_ROUTES), '/llms.txt'] as const;

export function isValidPage(path: string) {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return Object.values(SITE_ROUTES).some(route => route.endsWith('/*?')
    ? normalized === route.slice(0, -3) || normalized.startsWith(route.slice(0, -2))
    : route === normalized);
}

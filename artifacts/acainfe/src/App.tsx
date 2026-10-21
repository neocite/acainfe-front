import { useEffect, useRef, type ReactNode } from 'react';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { ClerkProvider, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { ptBR } from '@clerk/localizations';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Account from './pages/Account';
import { SignInPage, SignUpPage } from './pages/Auth';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { clerkAppearance } from './lib/clerk-appearance';
import { INSTITUTIONAL_ROUTES, SITE_ROUTES } from './lib/site-routes';
import Institutional from './pages/Institutional';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) queryClient.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

function PrivatePage({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return <div className="app-loading">Preparando seu espaço…</div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <div key={userId}>{children}</div>;
}
function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  return isLoaded && isSignedIn ? <Redirect to="/app" /> : <Landing />;
}
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    signInFallbackRedirectUrl={`${basePath}/app`}
    signUpFallbackRedirectUrl={`${basePath}/app`}
    localization={ptBR}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path={SITE_ROUTES.home} component={HomeRedirect} />
        <Route path={SITE_ROUTES.signIn} component={SignInPage} />
        <Route path={SITE_ROUTES.signUp} component={SignUpPage} />
        <Route path={SITE_ROUTES.app}><PrivatePage><Onboarding /></PrivatePage></Route>
        <Route path={SITE_ROUTES.account}><PrivatePage><Account /></PrivatePage></Route>
        <Route path={SITE_ROUTES.onboarding}><PrivatePage><Onboarding /></PrivatePage></Route>
        {Object.values(INSTITUTIONAL_ROUTES).map(path => <Route key={path} path={path}><Institutional path={path} /></Route>)}
        <Route><main style={{ padding: 60 }}><h1>Essa página não está por aqui.</h1><a href={basePath || '/'}>Voltar ao início</a></main></Route>
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}
export default function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

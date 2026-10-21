import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import Landing from './pages/Landing';
import type { PublicSiteData } from './lib/public-site-content';
import Institutional from './pages/Institutional';

export function renderPublicPage(data: PublicSiteData, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60000, gcTime: Infinity } } });
  client.setQueryData(['public-pricing'], data.pricing);
  client.setQueryData(['public-coverage'], data.coverage);
  const html = renderToString(
    <Router ssrPath={path}><QueryClientProvider client={client}>{path === '/' ? <Landing /> : <Institutional path={path} />}</QueryClientProvider></Router>,
  );
  client.clear();
  return html;
}
export const renderLanding = (data: PublicSiteData) => renderPublicPage(data);

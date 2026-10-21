import { createRoot, hydrateRoot } from 'react-dom/client';
import { queryClient } from './lib/queryClient';
import type { PublicSiteData } from './lib/public-site-content';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const root = document.getElementById('root')!;
const initialData = document.getElementById('public-site-data');
if (initialData?.textContent) {
  const data: PublicSiteData = JSON.parse(initialData.textContent);
  queryClient.setQueryData(['public-pricing'], data.pricing);
  queryClient.setQueryData(['public-coverage'], data.coverage);
}
const options = {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error: unknown, errorInfo: { componentStack?: string | null }) => {
    console.error(error, errorInfo.componentStack);
  },
};
const tree = <ErrorBoundary>
    <App />
  </ErrorBoundary>;
if (root.dataset.prerendered === 'true') hydrateRoot(root, tree, options);
else createRoot(root, options).render(tree);

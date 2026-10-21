import { publicCanonicalUrl } from './site-routes';

/** Keep SPA transitions consistent with the metadata rendered by the server. */
export function setPublicCanonical(path: string) {
  const url = publicCanonicalUrl(path);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
  let ogUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement('meta');
    ogUrl.setAttribute('property', 'og:url');
    document.head.appendChild(ogUrl);
  }
  ogUrl.content = url;
}

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { getAnalytics } from '../lib/analytics';

/** One manual pageview per canonical SPA route; the config disables automatic pageviews. */
export function AnalyticsNavigation() {
  const [path] = useLocation();
  useEffect(() => {
    const sync = () => {
      const tracker = getAnalytics();
      if (tracker?.consent() === 'denied') tracker.setConsent('denied');
      else tracker?.init();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    try { const tracker = getAnalytics(); tracker?.init(); tracker?.pageView(); } catch { /* Nonessential. */ }
  }, [path]);
  return null;
}

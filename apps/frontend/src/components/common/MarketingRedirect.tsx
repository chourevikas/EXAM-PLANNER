import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Spinner } from './Spinner';

/**
 * The public marketing pages (/, /about, /pricing, /exams, /current-affairs, legal) are served by
 * the Astro site in apps/marketing; host nginx routes those paths to it. When the SPA navigates to one
 * client-side, hand off with a full page load. In dev the Astro server runs on its own port.
 */
const MARKETING_ORIGIN: string =
  import.meta.env.VITE_MARKETING_ORIGIN ?? (import.meta.env.DEV ? 'http://localhost:4321' : '');

export const marketingUrl = (path: string) => `${MARKETING_ORIGIN}${path}`;

export function MarketingRedirect({ to }: { to?: string }) {
  const location = useLocation();
  const target = marketingUrl(to ?? `${location.pathname}${location.search}${location.hash}`);

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={40} />
    </div>
  );
}

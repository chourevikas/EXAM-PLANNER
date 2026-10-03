import type { ReactNode } from 'react';
import { Router, type Navigator } from 'react-router-dom';

/**
 * Lets SPA components that call useNavigate() run as Astro islands.
 * Every navigation becomes a full page load, since the target is usually
 * the SPA (e.g. /guest-exam) living behind the same domain.
 */
const toHref = (to: Parameters<Navigator['push']>[0]) =>
  typeof to === 'string' ? to : `${to.pathname ?? ''}${to.search ?? ''}${to.hash ?? ''}`;

const navigator: Navigator = {
  createHref: toHref,
  push: (to) => window.location.assign(toHref(to)),
  replace: (to) => window.location.replace(toHref(to)),
  go: (delta) => window.history.go(delta),
};

export function RouterShim({ path, children }: { path: string; children: ReactNode }) {
  return (
    <Router location={path} navigator={navigator}>
      {children}
    </Router>
  );
}

// Force rebuild to clear cached deployment
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import './styles/index.css';
import './styles/themes.css';

import { ClerkProvider } from '@clerk/clerk-react';
import { initMonitoring } from './utils/monitoring';
import { CrashScreen } from './components/common/CrashScreen';

initMonitoring();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.warn("Missing Clerk Publishable Key");
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashScreen />}>
      <ClerkProvider publishableKey={clerkPubKey || ""}>
        <App />
      </ClerkProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

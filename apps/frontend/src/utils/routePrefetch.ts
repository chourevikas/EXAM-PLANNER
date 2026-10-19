const prefetched = new Set<string>();

/**
 * Pre-fetches lazy route chunks on mouse hover or touch start.
 * Enables zero-latency, instantaneous page transitions.
 */
export function prefetchRoute(routePath: string) {
  if (!routePath || prefetched.has(routePath)) return;
  prefetched.add(routePath);

  switch (routePath) {
    case '/dashboard':
      import('../pages/DashboardPage');
      break;
    case '/study-planner':
      import('../pages/StudyPlannerPage');
      break;
    case '/analytics':
      import('../pages/AnalyticsPage');
      break;
    case '/bookmarks':
      import('../pages/BookmarksPage');
      break;
    case '/mistakes':
      import('../pages/MistakesPage');
      break;
    case '/challenges':
      import('../pages/ChallengesPage');
      break;
    case '/mocks':
      import('../pages/MockSelectionPage');
      break;
    case '/pyq':
      import('../pages/PYQSelectionPage');
      break;
    case '/learn/current-affairs':
      import('../pages/CurrentAffairsPage');
      break;
    case '/notifications':
      import('../pages/NotificationsPage');
      break;
    case '/reports/weekly':
      import('../pages/WeeklyInsightsPage');
      break;
    case '/reports/monthly':
      import('../pages/MonthlyReportPage');
      break;
    case '/billing':
      import('../pages/PricingPage');
      break;
    case '/profile':
      import('../pages/ProfilePage');
      break;
    case '/admin':
      import('../pages/AdminPage');
      break;
    default:
      break;
  }
}

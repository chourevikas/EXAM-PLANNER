import React, { useEffect, useState } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { HeroWelcomeBanner } from '../components/student/HeroWelcomeBanner';
import { StudentMetricsGrid } from '../components/student/StudentMetricsGrid';
import { PerformanceAnalyticsCharts } from '../components/student/PerformanceAnalyticsCharts';
import { PsychometricAIPanel } from '../components/student/PsychometricAIPanel';
import { UpNextQueueCard } from '../components/student/UpNextQueueCard';
import { fetchCurrentUser } from '../services/authService';

export function DashboardPage() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  useEffect(() => {
    fetchCurrentUser().then(data => {
      setUser(data);
    }).catch(err => {
      console.error("Failed to fetch fresh user data:", err);
    });
  }, []);

  const isFreeTier = user.subscription_tier !== 'PREMIUM';

  return (
    <StudentLayout pageTitle="Dashboard">
      {/* 1. Hero Welcome & Quick Action Banner */}
      <HeroWelcomeBanner user={user} />

      {/* 2. Key Metrics Grid */}
      <StudentMetricsGrid user={user} />

      {/* 3. Performance Analytics Charts */}
      <PerformanceAnalyticsCharts />

      {/* 4. Deep Psychometric AI Panel & Up Next Queue Card */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        <PsychometricAIPanel isFreeTier={isFreeTier} />
        <UpNextQueueCard />
      </section>
    </StudentLayout>
  );
}

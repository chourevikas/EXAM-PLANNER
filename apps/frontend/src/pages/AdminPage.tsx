import React, { useState } from 'react';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminTopNav } from '../components/admin/AdminTopNav';

/* View Components */
import { AdminOverviewView } from '../components/admin/AdminOverviewView';
import { QuestionBankManager } from '../components/admin/QuestionBankManager';
import { UploadReviewView } from '../components/admin/UploadReviewView';
import { AIQueueView } from '../components/admin/views/AIQueueView';
import { QuestionReviewView } from '../components/admin/views/QuestionReviewView';
import { MockTestsView } from '../components/admin/views/MockTestsView';
import { ResourcesView } from '../components/admin/views/ResourcesView';
import { UsersView } from '../components/admin/views/UsersView';
import { AnalyticsView } from '../components/admin/views/AnalyticsView';
import { SubscriptionsView } from '../components/admin/views/SubscriptionsView';
import { ExamPipelineStatusView } from '../components/admin/views/ExamPipelineStatusView';

export function AdminPage() {
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <AdminOverviewView onNavigate={setActiveView} />;
      case 'pipeline-status':
        return <ExamPipelineStatusView />;
      case 'questions':
        return <QuestionBankManager />;
      case 'upload':
        return <UploadReviewView />;
      case 'ai-queue':
        return <AIQueueView />;
      case 'review':
        return <QuestionReviewView />;
      case 'mock-tests':
        return <MockTestsView />;
      case 'resources':
        return <ResourcesView />;
      case 'users':
        return <UsersView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'subscriptions':
        return <SubscriptionsView />;
      default:
        return <AdminOverviewView onNavigate={setActiveView} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-body)' }}>
      {/* Figma Collapsible Sidebar */}
      <AdminSidebar
        activeView={activeView}
        onNavigate={setActiveView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((p) => !p)}
      />

      {/* Main Container with Sticky Header & Views */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminTopNav activeView={activeView} onNavigate={setActiveView} />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-body)' }}>
          {renderView()}
        </main>
      </div>
    </div>
  );
}

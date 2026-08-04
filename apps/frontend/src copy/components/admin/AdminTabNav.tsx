import React from 'react';
import { AdminTab } from '../../types/exam';

interface AdminTabNavProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

export function AdminTabNav({ activeTab, onSelectTab }: AdminTabNavProps) {
  return (
    <div className="admin-tabs">
      <button
        onClick={() => onSelectTab('upload')}
        className={`admin-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
      >
        📤 Upload Exam Paper
      </button>
      <button
        onClick={() => onSelectTab('overview')}
        className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
      >
        📊 Quick Stats
      </button>
      <button
        onClick={() => onSelectTab('bank')}
        className={`admin-tab-btn ${activeTab === 'bank' ? 'active' : ''}`}
      >
        📚 Question Bank Manager
      </button>
    </div>
  );
}

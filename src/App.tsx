import React, { useState, useEffect } from 'react';
import { Navbar, NavView } from './components/Navbar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { MediaLibraryView } from './components/MediaLibraryView.tsx';
import { RelayPipelineView } from './components/RelayPipelineView.tsx';
import { JobQueueView } from './components/JobQueueView.tsx';
import { StorageManagerView } from './components/StorageManagerView.tsx';
import { TelegramBotConsoleView } from './components/TelegramBotConsoleView.tsx';
import { BackupLogsView } from './components/BackupLogsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { UploadModal } from './components/UploadModal.tsx';
import {
  StorageStats,
  JobRecord,
  FileRecord,
  TelegramBotStatus,
  AppSettings,
} from './types/index.ts';

export default function App() {
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [botStatus, setBotStatus] = useState<TelegramBotStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Check URL parameters for view selection or autostart
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as NavView;
    if (viewParam) {
      setCurrentView(viewParam);
    }
  }, []);

  const fetchData = async () => {
    try {
      const [storageRes, filesRes, jobsRes, botRes, settingsRes] = await Promise.all([
        fetch('/api/storage/overview'),
        fetch('/api/files?pageSize=100'),
        fetch('/api/jobs?pageSize=50'),
        fetch('/api/bot/status'),
        fetch('/api/settings'),
      ]);

      if (storageRes.ok) setStorageStats(await storageRes.json());
      if (filesRes.ok) {
        const data = await filesRes.json();
        setRecentFiles(data.files || []);
      }
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }
      if (botRes.ok) setBotStatus(await botRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch (err) {
      console.error('Error fetching application state:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const activeJobsCount = jobs.filter(
    (j) => j.status === 'PROCESSING' || j.status === 'VALIDATING' || j.status === 'UPLOADING'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#030712] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        storageStats={storageStats}
        botStatus={botStatus}
        activeJobsCount={activeJobsCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <DashboardView
            storageStats={storageStats}
            recentFiles={recentFiles}
            activeJobs={jobs}
            onNavigate={setCurrentView}
            onOpenUpload={() => setIsUploadModalOpen(true)}
          />
        )}

        {currentView === 'library' && (
          <MediaLibraryView
            files={recentFiles}
            onRefresh={fetchData}
            onOpenUpload={() => setIsUploadModalOpen(true)}
          />
        )}

        {currentView === 'relay' && (
          <RelayPipelineView onRefreshStats={fetchData} />
        )}

        {currentView === 'queue' && (
          <JobQueueView jobs={jobs} onRefresh={fetchData} />
        )}

        {currentView === 'storage' && (
          <StorageManagerView storageStats={storageStats} />
        )}

        {currentView === 'bot' && (
          <TelegramBotConsoleView
            botStatus={botStatus}
            ownerId={settings?.tgOwnerId || '1820662744'}
          />
        )}

        {currentView === 'backups' && <BackupLogsView />}

        {currentView === 'settings' && (
          <SettingsView settings={settings} onRefresh={fetchData} />
        )}
      </main>

      {/* Global Ingestion Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={fetchData}
      />

      {/* Subtle Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <p>
          ARCHIVEX Media Archive Platform • Strict Owner-ID Protected • Self-Hosted & Local Storage
        </p>
      </footer>
    </div>
  );
}

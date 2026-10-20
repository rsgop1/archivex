import React from 'react';
import {
  Archive,
  LayoutDashboard,
  FolderSync,
  ListTodo,
  HardDrive,
  Bot,
  ShieldCheck,
  Settings as SettingsIcon,
  Activity,
  Menu,
  X,
} from 'lucide-react';
import { StorageStats, TelegramBotStatus } from '../types/index.ts';
import { formatBytes } from '../utils/sanitize.ts';

export type NavView =
  | 'dashboard'
  | 'library'
  | 'relay'
  | 'queue'
  | 'storage'
  | 'bot'
  | 'backups'
  | 'settings';

interface NavbarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  storageStats: StorageStats | null;
  botStatus: TelegramBotStatus | null;
  activeJobsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  storageStats,
  botStatus,
  activeJobsCount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems: Array<{ id: NavView; label: string; icon: React.ReactNode; badge?: number | string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'library', label: 'Media Library', icon: <Archive className="w-4 h-4" /> },
    { id: 'relay', label: 'Channel Relay', icon: <FolderSync className="w-4 h-4 text-emerald-400" />, badge: 'Priority' },
    { id: 'queue', label: 'Job Queue', icon: <ListTodo className="w-4 h-4" />, badge: activeJobsCount > 0 ? activeJobsCount : undefined },
    { id: 'storage', label: 'Storage', icon: <HardDrive className="w-4 h-4" /> },
    { id: 'bot', label: 'TG Bot Console', icon: <Bot className="w-4 h-4 text-sky-400" /> },
    { id: 'backups', label: 'Backups & Audit', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectView('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Archive className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-wider text-white">ARCHIVEX</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Self-Hosted
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Telegram-Controlled Media Platform</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        typeof item.badge === 'number'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* System Health Status Pills */}
          <div className="hidden md:flex items-center gap-3">
            {storageStats && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Free:</span>
                <span className="font-mono font-medium text-slate-200">
                  {formatBytes(storageStats.freeBytes)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 font-medium">Workers Active</span>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden px-4 pt-2 pb-4 space-y-1 bg-slate-900 border-b border-slate-800">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelectView(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                currentView === item.id
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

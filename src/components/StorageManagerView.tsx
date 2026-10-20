import React from 'react';
import {
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  Folder,
  FileVideo,
  FileText,
  FileImage,
  FileAudio,
  Archive,
  Info,
} from 'lucide-react';
import { StorageStats } from '../types/index.ts';
import { formatBytes } from '../utils/sanitize.ts';

interface StorageManagerViewProps {
  storageStats: StorageStats | null;
}

export const StorageManagerView: React.FC<StorageManagerViewProps> = ({ storageStats }) => {
  const total = storageStats ? storageStats.totalBytes : 500 * 1024 * 1024 * 1024;
  const used = storageStats ? storageStats.usedBytes : 856980640;
  const free = storageStats ? storageStats.freeBytes : 380 * 1024 * 1024 * 1024;
  const reserve = storageStats ? storageStats.reserveThresholdBytes : 5 * 1024 * 1024 * 1024;
  const isCritical = storageStats ? storageStats.isReserveCritical : false;

  const usedPct = Math.min(100, Math.max(1, Math.round((used / total) * 100)));

  const directories = [
    { name: 'archive/videos', desc: 'Permanent indexed MP4/MKV video lectures', icon: <FileVideo className="w-4 h-4 text-indigo-400" /> },
    { name: 'archive/documents', desc: 'Verified PDF notes, syllabi, and lecture slides', icon: <FileText className="w-4 h-4 text-emerald-400" /> },
    { name: 'archive/images', desc: 'Diagrams, charts, and lecture whiteboard captures', icon: <FileImage className="w-4 h-4 text-purple-400" /> },
    { name: 'archive/audio', desc: 'Seminar audio recordings and podcasts', icon: <FileAudio className="w-4 h-4 text-amber-400" /> },
    { name: 'archive/temporary', desc: 'In-progress downloads & staging area (isolated from originals)', icon: <Folder className="w-4 h-4 text-slate-400" /> },
    { name: 'archive/quarantine', desc: 'Soft-deleted or suspicious files awaiting explicit purge', icon: <AlertTriangle className="w-4 h-4 text-rose-400" /> },
    { name: 'archive/manifests', desc: 'Cryptographic JSON manifests with SHA-256 signatures', icon: <Archive className="w-4 h-4 text-sky-400" /> },
    { name: 'archive/logs', desc: 'Auto-rotating security and audit logs', icon: <Info className="w-4 h-4 text-slate-400" /> },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-indigo-400" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Local Storage & Volumes Engine
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Filesystem layout, disk reserve protection, and zero-data-loss architecture
        </p>
      </div>

      {/* Critical Reserve Warning Banner if applicable */}
      {isCritical && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/50 flex items-center gap-3 text-rose-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <strong className="font-bold">Disk Space Alert:</strong> Free storage is below the configured {formatBytes(reserve)} safe threshold. New ingestion operations are paused to preserve disk integrity.
          </div>
        </div>
      )}

      {/* Main Storage Gauge Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Primary Laptop Storage Volume
            </span>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {formatBytes(free)} Available
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Root: <code className="text-indigo-300 font-mono">./archive/</code>
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-right">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Capacity</span>
              <span className="font-mono font-bold text-slate-200">{formatBytes(total)}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-right">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Used Space</span>
              <span className="font-mono font-bold text-indigo-400">{formatBytes(used)}</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>Utilization: {usedPct}%</span>
            <span>Reserve Threshold: {formatBytes(reserve)}</span>
          </div>
          <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, usedPct)}%` }}
            />
          </div>
        </div>

        {/* Safety Constitution Notice */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Immutable Retention Policy</span>
          </div>
          <p>
            ARCHIVEX enforces strict protection: <strong>Original media files are never automatically deleted</strong> to free space. When disk space runs low, new jobs are queued with status <code>PAUSED</code>, and deletions always require explicit owner confirmation and route through the quarantine vault.
          </p>
        </div>
      </div>

      {/* Directory Structure Explorer */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
          Local Filesystem Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {directories.map((dir, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3 hover:border-slate-700 transition-colors"
            >
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                {dir.icon}
              </div>
              <div className="space-y-0.5">
                <code className="text-xs font-bold text-slate-200 font-mono block">
                  {dir.name}/
                </code>
                <p className="text-[11px] text-slate-400">{dir.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

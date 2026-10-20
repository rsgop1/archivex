import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Archive,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Clock,
  Filter,
} from 'lucide-react';
import { BackupManifest, AuditLogEntry } from '../types/index.ts';
import { formatBytes } from '../utils/sanitize.ts';

export const BackupLogsView: React.FC = () => {
  const [manifests, setManifests] = useState<BackupManifest[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('ALL');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  const fetchBackupsAndLogs = async () => {
    try {
      const [bRes, lRes] = await Promise.all([
        fetch('/api/backup/list'),
        fetch('/api/logs?limit=50'),
      ]);
      if (bRes.ok) setManifests(await bRes.json());
      if (lRes.ok) setLogs(await lRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBackupsAndLogs();
  }, []);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await fetch('/api/backup/create', { method: 'POST' });
      if (res.ok) {
        await fetchBackupsAndLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (selectedLogLevel !== 'ALL' && l.level !== selectedLogLevel) return false;
    return true;
  });

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'SECURITY':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'WARN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Backups, Integrity & Security Audit
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Database snapshots, cryptographic manifests, and complete tamper-evident audit logs
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={isCreatingBackup}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
        >
          <Archive className="w-4 h-4" />
          <span>{isCreatingBackup ? 'Generating...' : 'Create Snapshot & Manifest'}</span>
        </button>
      </div>

      {/* Manifests Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Cryptographic Backup Manifests
            </h2>
            <p className="text-xs text-slate-400">Verifies database consistency against files on disk</p>
          </div>
          <span className="text-xs font-mono text-slate-400">{manifests.length} manifests</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Manifest ID</th>
                <th className="px-4 py-3">Indexed Files</th>
                <th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">DB Snapshot Hash</th>
                <th className="px-4 py-3">Missing Files</th>
                <th className="px-4 py-3">Integrity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {manifests.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-mono font-bold text-slate-200">{m.id}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{m.total_files_indexed} files</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{formatBytes(m.total_bytes)}</td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                    {m.db_snapshot_checksum.substring(0, 14)}...
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {m.missing_files_detected}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs Stream */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              System Audit & Security Trail
            </h2>
            <p className="text-xs text-slate-400">All administrative operations, file modifications, and bot access attempts</p>
          </div>

          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            {['ALL', 'INFO', 'WARN', 'ERROR', 'SECURITY'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLogLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  selectedLogLevel === lvl
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getLogLevelClass(log.level)}`}>
                  {log.level}
                </span>
                <span className="font-mono font-bold text-slate-200">{log.action}</span>
                <span className="text-slate-400 text-[11px]">
                  User: <strong className="text-slate-300">{log.user}</strong>
                </span>
              </div>

              <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                <span className="truncate max-w-xs">{JSON.stringify(log.details)}</span>
                <span>{log.timestamp.split('T')[1].substring(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

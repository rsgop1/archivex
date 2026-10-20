import React, { useState } from 'react';
import {
  ListTodo,
  Play,
  Pause,
  RotateCw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Trash2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { JobRecord, JobState } from '../types/index.ts';

interface JobQueueViewProps {
  jobs: JobRecord[];
  onRefresh: () => void;
}

const ALL_STATES: JobState[] = [
  'QUEUED',
  'VALIDATING',
  'PROCESSING',
  'VERIFYING',
  'READY',
  'UPLOADING',
  'COMPLETED',
  'RETRY_WAIT',
  'PAUSED',
  'FAILED',
  'CANCELLED',
];

export const JobQueueView: React.FC<JobQueueViewProps> = ({ jobs, onRefresh }) => {
  const [filterState, setFilterState] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredJobs = jobs.filter((j) => {
    if (filterState !== 'all' && j.status !== filterState) return false;
    return true;
  });

  const handlePause = async (id: string) => {
    setActionLoadingId(id);
    try {
      await fetch(`/api/jobs/${id}/pause`, { method: 'POST' });
      onRefresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoadingId(id);
    try {
      await fetch(`/api/jobs/${id}/resume`, { method: 'POST' });
      onRefresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setActionLoadingId(id);
    try {
      await fetch(`/api/jobs/${id}/retry`, { method: 'POST' });
      onRefresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setActionLoadingId(id);
    try {
      await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
      onRefresh();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await fetch('/api/jobs/clear-completed', { method: 'POST' });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const getStateBadgeClass = (status: JobState) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'PROCESSING':
      case 'VALIDATING':
      case 'VERIFYING':
      case 'UPLOADING':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse';
      case 'RETRY_WAIT':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'PAUSED':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'FAILED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'CANCELLED':
        return 'bg-slate-900 text-slate-500 border-slate-800';
      default:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Persistent Job Engine Queue
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            11-state deterministic transitions, exponential backoff, and crash-resilient persistence
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleClearCompleted}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Finished</span>
          </button>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* State Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          onClick={() => setFilterState('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            filterState === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          All Jobs ({jobs.length})
        </button>
        {ALL_STATES.map((st) => {
          const count = jobs.filter((j) => j.status === st).length;
          if (count === 0 && filterState !== st) return null; // hide empty to keep UI tidy
          return (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filterState === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st} ({count})
            </button>
          );
        })}
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <ListTodo className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No jobs match this state</p>
            <p className="text-xs text-slate-500 mt-1">Workers are idle and waiting for new tasks.</p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStateBadgeClass(
                      job.status
                    )}`}
                  >
                    {job.status}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    {job.operation_type}
                  </span>
                  <span className="text-xs font-mono text-slate-500">ID: {job.id}</span>
                </div>

                {/* Attempt and timestamps */}
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span>
                    Attempts: <strong className="text-slate-200">{job.attempts || 1} / {job.max_attempts || 3}</strong>
                  </span>
                  <span className="font-mono text-slate-500">
                    {job.created_at.split('T')[1].substring(0, 8)}
                  </span>
                </div>
              </div>

              {/* Job title / file name */}
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white font-mono break-all">
                  {job.file_name || `Operation: ${job.operation_type}`}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {job.current_step}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Progress</span>
                  <span>{job.progress_percent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${job.progress_percent}%` }}
                  />
                </div>
              </div>

              {/* Error details if failed or retry wait */}
              {job.error_message && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-mono">
                  {job.error_message}
                </div>
              )}

              {/* Job Action Controls */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                {(job.status === 'PROCESSING' || job.status === 'VALIDATING' || job.status === 'UPLOADING') && (
                  <button
                    onClick={() => handlePause(job.id)}
                    disabled={actionLoadingId === job.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}

                {job.status === 'PAUSED' && (
                  <button
                    onClick={() => handleResume(job.id)}
                    disabled={actionLoadingId === job.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </button>
                )}

                {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                  <button
                    onClick={() => handleRetry(job.id)}
                    disabled={actionLoadingId === job.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Retry Job</span>
                  </button>
                )}

                {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleCancel(job.id)}
                    disabled={actionLoadingId === job.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 text-xs font-semibold"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

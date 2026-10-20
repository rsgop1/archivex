import React, { useState, useEffect } from 'react';
import {
  FolderSync,
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertCircle,
  FileVideo,
  FileText,
  Clock,
  ArrowRight,
  ShieldCheck,
  Send,
  Terminal,
  Copy,
  Check,
  Sparkles,
  HelpCircle,
  UserCheck,
  LogIn,
  Key,
  Smartphone,
  RefreshCw,
  Info,
} from 'lucide-react';
import { RelayPipelineStatus } from '../types/index.ts';
import { formatBytes } from '../utils/sanitize.ts';

interface RelayPipelineViewProps {
  onRefreshStats: () => void;
}

interface DialogItem {
  id: string;
  title: string;
  isChannel: boolean;
  isGroup: boolean;
}

export const RelayPipelineView: React.FC<RelayPipelineViewProps> = ({ onRefreshStats }) => {
  const [status, setStatus] = useState<RelayPipelineStatus>({
    isActive: false,
    isPaused: false,
    sourceChannel: 'Maths Mania - निर्माण Maths',
    targetChannel: '-1003939314503',
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    history: [],
  });

  const [sourceInput, setSourceInput] = useState('Maths Mania - निर्माण Maths');
  const [targetInput, setTargetInput] = useState('-1003939314503');
  const [limitMessages, setLimitMessages] = useState(20);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Userbot state
  const [userbotStatus, setUserbotStatus] = useState<{
    isLoggedIn: boolean;
    isRelaying?: boolean;
    user?: { id: string; firstName: string; username?: string; phone?: string };
  }>({ isLoggedIn: false });

  const [dialogs, setDialogs] = useState<DialogItem[]>([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);

  // Login modal
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginTab, setLoginTab] = useState<'phone' | 'string'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [manualSessionString, setManualSessionString] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/relay/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error fetching relay status:', err);
    }
  };

  const fetchUserbotStatus = async () => {
    try {
      const res = await fetch('/api/userbot/status');
      if (res.ok) {
        const data = await res.json();
        setUserbotStatus(data);
        if (data.isLoggedIn && dialogs.length === 0) {
          loadDialogs();
        }
      }
    } catch (err) {
      console.error('Error fetching userbot status:', err);
    }
  };

  const loadDialogs = async () => {
    setLoadingDialogs(true);
    try {
      const res = await fetch('/api/userbot/dialogs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.dialogs)) {
          setDialogs(data.dialogs);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDialogs(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchUserbotStatus();
    const interval = setInterval(() => {
      fetchStatus();
      fetchUserbotStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/relay/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChannel: sourceInput,
          targetChannel: targetInput,
          limitMessages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start relay');
      }
      setStatus(data);
      onRefreshStats();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error initiating sequential relay');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      await fetch('/api/relay/pause', { method: 'POST' });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResume = async () => {
    try {
      await fetch('/api/relay/resume', { method: 'POST' });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStop = async () => {
    try {
      await fetch('/api/relay/stop', { method: 'POST' });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  // Login handlers
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/userbot/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request login code');
      setPhoneCodeHash(data.phoneCodeHash);
      setCodeSent(true);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/userbot/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneNumber,
          code: verificationCode,
          password: twoFactorPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setShowLoginModal(false);
      fetchUserbotStatus();
      loadDialogs();
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleSaveStringSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/userbot/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionString: manualSessionString }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid session string');
      setShowLoginModal(false);
      fetchUserbotStatus();
      loadDialogs();
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FolderSync className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Channel-to-Channel Media Relay</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Realistic MTProto Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Streams and downloads restricted videos and PDFs from your source channel sequentially, verifies SHA-256 integrity, and re-uploads them to your destination channel.
          </p>
        </div>

        {/* Userbot Connection Status Badge & Button */}
        <div className="flex items-center gap-3">
          {userbotStatus.isLoggedIn ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>
                Connected: <strong>{userbotStatus.user?.firstName || 'Userbot'}</strong> (ID: {userbotStatus.user?.id})
              </span>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Connect Telegram Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Crucial Explanation Box */}
      <div className="bg-amber-950/30 border border-amber-800/60 rounded-2xl p-4.5 text-xs text-amber-200/90 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-300">
          <Info className="w-4 h-4" />
          <span>Real Telegram Architecture Note (Kyu Session aur Bot Token dono zaroori hain):</span>
        </div>
        <p className="text-amber-200/80 leading-relaxed">
          1. <strong>Private Restricted Batch Channels ("Maths Mania - निर्माण Maths")</strong>: Telegram bots cannot read messages in private channels where "saving/forwarding is restricted". Only a joined user account (MTProto session) can read and download them.
        </p>
        <p className="text-amber-200/80 leading-relaxed">
          2. <strong>Destination Channel ("Rise Prism", ID: -1003939314503)</strong>: Files are uploaded directly to Rise Prism. Local files are purged immediately after upload to preserve your laptop disk space.
        </p>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="flex items-center justify-between p-4 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Configuration & Progress Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Card */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Pipeline Setup</h2>
            {userbotStatus.isLoggedIn && (
              <button
                onClick={loadDialogs}
                disabled={loadingDialogs}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDialogs ? 'animate-spin' : ''}`} />
                <span>Refresh Joined Channels</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Source Channel */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Source Channel (Name / ID)
              </label>
              {dialogs.length > 0 ? (
                <div className="space-y-1">
                  <select
                    value={sourceInput}
                    disabled={status.isActive}
                    onChange={(e) => setSourceInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Maths Mania - निर्माण Maths">Maths Mania - निर्माण Maths (Default Batch)</option>
                    {dialogs.map((d) => (
                      <option key={d.id} value={d.title}>
                        {d.title} ({d.id})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="text"
                  value={sourceInput}
                  disabled={status.isActive}
                  onChange={(e) => setSourceInput(e.target.value)}
                  placeholder="e.g. Maths Mania - निर्माण Maths"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              )}
              <p className="text-[11px] text-slate-500">Channel from which media will be downloaded</p>
            </div>

            {/* Destination Channel */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Destination Channel ID
              </label>
              <input
                type="text"
                value={targetInput}
                disabled={status.isActive}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="e.g. -1003939314503 (Rise Prism)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">Channel where media will be uploaded (Rise Prism)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Message Batch Limit
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={limitMessages}
                disabled={status.isActive}
                onChange={(e) => setLimitMessages(parseInt(e.target.value, 10) || 10)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500">Number of media files to process sequentially from start</p>
            </div>

            <div className="flex flex-col justify-end space-y-1.5">
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Purge local file after upload:</span>
                <span className="font-bold text-emerald-400">ENABLED (Auto Clean)</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800">
            {!status.isActive ? (
              <button
                onClick={handleStart}
                disabled={loading || !sourceInput || !targetInput}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Sequential Channel Relay</span>
              </button>
            ) : (
              <>
                {status.isPaused ? (
                  <button
                    onClick={handleResume}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume Pipeline</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-all cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause Pipeline</span>
                  </button>
                )}

                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Relay</span>
                </button>
              </>
            )}

            {!userbotStatus.isLoggedIn && (
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 ml-2"
              >
                Awaiting Telegram Session Login
              </button>
            )}
          </div>
        </div>

        {/* Live Status Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Relay Status
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  status.isActive
                    ? status.isPaused
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {status.isActive ? (status.isPaused ? 'PAUSED' : 'STREAMING & RELAYING') : 'READY / IDLE'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Files in Run:</span>
                <span className="font-mono font-bold text-white">{status.totalFiles || limitMessages}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Relayed to Rise Prism:</span>
                <span className="font-mono font-bold text-emerald-400">{status.completedFiles}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Failed / Retrying:</span>
                <span className="font-mono font-bold text-rose-400">{status.failedFiles}</span>
              </div>
            </div>

            {/* Currently Active Transfer */}
            {status.currentFile ? (
              <div className="p-3.5 bg-slate-950 border border-indigo-900/50 rounded-xl space-y-2 mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-300 truncate max-w-[180px]">
                    {status.currentFile.name}
                  </span>
                  <span className="font-mono text-indigo-400 font-bold">{status.currentFile.percent}%</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${status.currentFile.percent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 truncate">{status.currentFile.step}</p>
              </div>
            ) : (
              <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl text-center text-xs text-slate-500">
                No active transfer. Click Start to begin sequential archiving.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Inter-file safe delay: 3s</span>
            <span>Resumable: Yes</span>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
          Recent Relayed Media History
        </h3>
        {status.history.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No completed relays yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3 font-semibold">File Name</th>
                  <th className="pb-3 font-semibold">Size</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">SHA-256 Checksum</th>
                  <th className="pb-3 font-semibold">Relayed At</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {status.history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/20">
                    <td className="py-3 font-medium text-slate-200">{item.fileName}</td>
                    <td className="py-3 font-mono text-slate-400">{formatBytes(item.fileSize)}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-500 text-[11px]">{item.sha256.substring(0, 14)}...</td>
                    <td className="py-3 text-slate-400">{new Date(item.uploadedAt).toLocaleString()}</td>
                    <td className="py-3">
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Success</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <LogIn className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Connect Telegram Session</h3>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex bg-slate-950 p-1 rounded-xl">
              <button
                onClick={() => setLoginTab('phone')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  loginTab === 'phone' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Phone Number (OTP Code)
              </button>
              <button
                onClick={() => setLoginTab('string')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  loginTab === 'string' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Paste StringSession
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
                {loginError}
              </div>
            )}

            {loginTab === 'phone' ? (
              !codeSent ? (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Telegram Mobile Number (with country code)
                    </label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+919876543210"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-500">
                      Telegram will send an official login code to your Telegram app.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loginSubmitting || !phoneNumber}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    {loginSubmitting ? 'Sending Request...' : 'Send Login Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Enter Verification Code from Telegram
                    </label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="e.g. 54321"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Two-Step Verification Password (Optional)
                    </label>
                    <input
                      type="password"
                      value={twoFactorPassword}
                      onChange={(e) => setTwoFactorPassword(e.target.value)}
                      placeholder="Leave blank if 2FA password is not enabled"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginSubmitting || !verificationCode}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    {loginSubmitting ? 'Verifying...' : 'Verify & Complete Login'}
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleSaveStringSession} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Paste Telethon / Pyrogram StringSession
                  </label>
                  <textarea
                    rows={4}
                    value={manualSessionString}
                    onChange={(e) => setManualSessionString(e.target.value)}
                    placeholder="1BJWap1wBu8..."
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Pre-authenticated StringSession from your Telegram account.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loginSubmitting || !manualSessionString}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  {loginSubmitting ? 'Saving & Testing...' : 'Save & Connect Session'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

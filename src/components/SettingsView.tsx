import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Check,
  Bot,
  Sliders,
  HardDrive,
  Shield,
  Key,
  Terminal,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sparkles,
} from 'lucide-react';
import { AppSettings } from '../types/index.ts';

interface SettingsViewProps {
  settings: AppSettings | null;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onRefresh }) => {
  const [formData, setFormData] = useState<AppSettings>(
    settings || {
      workerConcurrency: 2,
      retryLimit: 3,
      backoffBaseMs: 2000,
      diskReserveGb: 5,
      logVerbosity: 'INFO',
      tgBotToken: '',
      tgOwnerId: '1820662744',
      tgUserbotApiId: '',
      tgUserbotApiHash: '',
      tgUserbotSessionString: '',
      purgeLocalAfterUpload: true,
      defaultTargetChannelId: '@archivex_vault',
      defaultSourceChannelName: 'Engineering_Physics_Private_Archive',
      relayDelaySeconds: 3,
    }
  );

  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [copiedSessionScript, setCopiedSessionScript] = useState(false);
  const [showSessionHelper, setShowSessionHelper] = useState(false);

  const stringSessionPythonScript = `# Run this on your laptop once to get your Telethon StringSession:
# pip install telethon

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

API_ID = ${formData.tgUserbotApiId || 12345678}       # From my.telegram.org
API_HASH = "${formData.tgUserbotApiHash || 'your_api_hash'}"  # From my.telegram.org

with TelegramClient(StringSession(), API_ID, API_HASH) as client:
    print("YOUR_SESSION_STRING:")
    print(client.session.save())
`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestCredentials = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: formData.tgBotToken,
          ownerId: formData.tgOwnerId,
          userbotSession: formData.tgUserbotSessionString,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: data.botTokenValid && data.ownerValid,
          message: data.message,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(stringSessionPythonScript);
    setCopiedSessionScript(true);
    setTimeout(() => setCopiedSessionScript(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              ARCHIVEX Credentials & Settings
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure Telegram Bot token, userbot session credentials, and automated disk cleanup
          </p>
        </div>

        <button
          type="button"
          onClick={handleTestCredentials}
          disabled={testingConnection}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold border border-slate-700 transition-colors"
        >
          <Bot className="w-4 h-4" />
          <span>{testingConnection ? 'Testing Connection...' : 'Test Telegram Credentials'}</span>
        </button>
      </div>

      {testResult && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs border ${
            testResult.success
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Telegram Bot Token & Owner ID */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Bot className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              1. Telegram Bot Token & Owner Gate
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Telegram Bot API Token
              </label>
              <input
                type="password"
                value={formData.tgBotToken}
                onChange={(e) => setFormData({ ...formData, tgBotToken: e.target.value })}
                placeholder="1234567890:ABCdefGHIjklMNOpqr..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Created via <code className="text-sky-300">@BotFather</code> for sending messages & files
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Owner Telegram User ID (Strict Allowlist)
              </label>
              <input
                type="text"
                value={formData.tgOwnerId}
                onChange={(e) => setFormData({ ...formData, tgOwnerId: e.target.value })}
                placeholder="e.g. 1820662744"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Your numeric Telegram ID from <code className="text-sky-300">@userinfobot</code>
              </p>
            </div>
          </div>
        </div>

        {/* Telegram Userbot Session (Restricted Private Channel Ingest) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                2. Telegram Userbot Session (For Restricted Private Channels)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSessionHelper(!showSessionHelper)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showSessionHelper ? 'Hide StringSession Guide' : 'How to get StringSession?'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Because restricted private channels disable bots and forbid "Save & Forward", ARCHIVEX can connect using your personal Telegram user session string. It runs locally on your laptop to download protected videos & PDFs one-by-one.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Telegram API ID (from my.telegram.org)
              </label>
              <input
                type="text"
                value={formData.tgUserbotApiId || ''}
                onChange={(e) => setFormData({ ...formData, tgUserbotApiId: e.target.value })}
                placeholder="e.g. 29384729"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Telegram API Hash (from my.telegram.org)
              </label>
              <input
                type="password"
                value={formData.tgUserbotApiHash || ''}
                onChange={(e) => setFormData({ ...formData, tgUserbotApiHash: e.target.value })}
                placeholder="e.g. b8c9d0e1f2a3456789abcdef..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Userbot StringSession Token
            </label>
            <textarea
              rows={3}
              value={formData.tgUserbotSessionString || ''}
              onChange={(e) => setFormData({ ...formData, tgUserbotSessionString: e.target.value })}
              placeholder="Paste your 1B... Telethon or Pyrogram StringSession here"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400">
              A string-encoded session token that lets your laptop read your authorized private channels without re-requesting phone OTP codes.
            </p>
          </div>

          {/* Collapsible StringSession Generator Helper */}
          {showSessionHelper && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold text-white">Generate StringSession in 30 seconds:</span>
                <button
                  type="button"
                  onClick={copyScript}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  {copiedSessionScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSessionScript ? 'Copied' : 'Copy Python Helper'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-slate-400 bg-slate-900/80 p-3 rounded-lg overflow-x-auto">
                {stringSessionPythonScript}
              </pre>
            </div>
          )}
        </div>

        {/* Storage Retention & Post-Upload Cleanup */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <HardDrive className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              3. Storage Retention & Automated Disk Cleanup
            </h2>
          </div>

          {/* User Confirmed Cleanup Toggle */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="purgeToggle" className="text-xs font-bold text-white cursor-pointer flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-emerald-400" />
                <span>Purge local media file from laptop disk after successful Telegram upload</span>
              </label>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                When enabled, once a video or PDF is verified and uploaded into your destination channel, its local disk file is automatically deleted to preserve your computer's hard drive space. The database keeps the SHA-256 hash and Telegram message link.
              </p>
            </div>
            <input
              type="checkbox"
              id="purgeToggle"
              checked={formData.purgeLocalAfterUpload}
              onChange={(e) => setFormData({ ...formData, purgeLocalAfterUpload: e.target.checked })}
              className="w-5 h-5 mt-1 rounded text-emerald-600 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Default Target Channel
              </label>
              <input
                type="text"
                value={formData.defaultTargetChannelId}
                onChange={(e) => setFormData({ ...formData, defaultTargetChannelId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Default Source Channel Name
              </label>
              <input
                type="text"
                value={formData.defaultSourceChannelName}
                onChange={(e) => setFormData({ ...formData, defaultSourceChannelName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Inter-file Delay (seconds)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={formData.relayDelaySeconds}
                onChange={(e) => setFormData({ ...formData, relayDelaySeconds: parseInt(e.target.value, 10) || 3 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
              <Check className="w-4 h-4" />
              <span>Credentials and settings successfully saved!</span>
            </span>
          )}
          {!savedSuccess && <span />}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

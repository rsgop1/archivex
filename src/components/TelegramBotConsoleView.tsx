import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  RotateCw,
  Sparkles,
  Key,
  CheckCircle2,
  ExternalLink,
  Radio,
  Play,
  Pause,
} from 'lucide-react';
import { TelegramBotStatus } from '../types/index.ts';

interface TelegramBotConsoleViewProps {
  botStatus: TelegramBotStatus | null;
  ownerId: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  senderName: string;
  senderId: string;
  text: string;
  time: string;
  keyboard?: Array<Array<{ text: string; callback_data?: string }>>;
  isError?: boolean;
}

export const TelegramBotConsoleView: React.FC<TelegramBotConsoleViewProps> = ({
  botStatus,
  ownerId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'user',
      senderName: 'Owner',
      senderId: ownerId || '1820662744',
      text: '/start',
      time: '21:30',
    },
    {
      id: 'msg-2',
      sender: 'bot',
      senderName: 'ARCHIVEX Bot',
      senderId: 'bot',
      text: `🏛️ **ARCHIVEX Media Archive Platform**\n*Owner Telegram Controller*\n\nWelcome back! You have full owner administrative access to the personal media archive on your laptop.\n\nUse the quick buttons below or type any command:`,
      time: '21:30',
      keyboard: [
        [
          { text: '📊 /status', callback_data: '/status' },
          { text: '🔄 /relay', callback_data: '/relay' },
          { text: '💾 /storage', callback_data: '/storage' },
        ],
        [
          { text: '📁 /files', callback_data: '/files' },
          { text: '⚙️ /queue', callback_data: '/queue' },
          { text: '🛡️ /backup', callback_data: '/backup' },
        ],
      ],
    },
  ]);

  const [inputCommand, setInputCommand] = useState('');
  const [activeSenderMode, setActiveSenderMode] = useState<'owner' | 'unauthorized'>('owner');
  const [isSending, setIsSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<any>(botStatus);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const currentSenderId = activeSenderMode === 'owner' ? ownerId || '1820662744' : '999999999';

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (res.ok) {
        const data = await res.json();
        setLiveStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const executeCommand = async (cmdText: string) => {
    if (!cmdText.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sender: 'user',
      senderName: activeSenderMode === 'owner' ? 'Owner' : 'Unauthorized User',
      senderId: currentSenderId,
      text: cmdText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputCommand('');
    setIsSending(true);

    try {
      const res = await fetch('/api/bot/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmdText,
          senderId: currentSenderId,
          senderUsername: activeSenderMode === 'owner' ? 'owner' : 'stranger',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: ChatMessage = {
          id: `msg-${Date.now()}-b`,
          sender: 'bot',
          senderName: 'ARCHIVEX Bot',
          senderId: 'bot',
          text: data.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          keyboard: data.keyboard,
          isError: data.isError,
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(inputCommand);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-sky-400" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Telegram Bot Interactive Console
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                liveStatus?.isPollingActive
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <Radio className={`w-3 h-3 ${liveStatus?.isPollingActive ? 'animate-pulse text-emerald-400' : ''}`} />
              <span>{liveStatus?.isPollingActive ? 'REAL POLLING ACTIVE' : 'SANDBOX SIMULATION'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Test owner-ID secured Telegram Bot API commands in real time. Commands work both here and inside your real Telegram app.
          </p>
        </div>

        {/* Security Role Switcher to test owner authorization */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-400 px-2">Sender Persona:</span>
          <button
            onClick={() => setActiveSenderMode('owner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSenderMode === 'owner'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authorized Owner ({ownerId || '1820662744'})</span>
          </button>
          <button
            onClick={() => setActiveSenderMode('unauthorized')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSenderMode === 'unauthorized'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Unauthorized User (ID: 999999999)</span>
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Terminal Window */}
        <div className="lg:col-span-3 bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[650px] shadow-2xl">
          {/* Chat Window Top Bar */}
          <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                TG
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white">ARCHIVEX Bot</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 fill-sky-400/20" />
                </div>
                <span className="text-[11px] text-emerald-400 font-medium">
                  {liveStatus?.isPollingActive ? 'live polling active • listening' : 'ready for command input'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Owner Gate</span>
              <span className="text-xs font-mono text-slate-300">ID: {currentSenderId}</span>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : msg.isError
                      ? 'bg-rose-950/60 border border-rose-500/40 text-rose-200 rounded-bl-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-75">
                    <span className="font-semibold">{msg.senderName}</span>
                    <span className="font-mono">{msg.time}</span>
                  </div>

                  {/* Message Text */}
                  <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {/* Inline Keyboards */}
                  {msg.keyboard && msg.keyboard.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                      {msg.keyboard.map((row, rIdx) => (
                        <div key={rIdx} className="flex flex-wrap gap-2">
                          {row.map((btn, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() => executeCommand(btn.callback_data || btn.text)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                            >
                              {btn.text}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a command (e.g. /status, /files, /queue, /relay, /backup)..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              onClick={() => executeCommand(inputCommand)}
              disabled={isSending || !inputCommand.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
              aria-label="Send command"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Command Reference & Token Guide */}
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Quick Telegram Commands
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { cmd: '/status', desc: 'System stats' },
                { cmd: '/relay', desc: 'Relay status' },
                { cmd: '/relay_start', desc: 'Start relay' },
                { cmd: '/files', desc: 'Recent files' },
                { cmd: '/queue', desc: 'Active queue' },
                { cmd: '/storage', desc: 'Disk space' },
                { cmd: '/duplicates', desc: 'SHA-256 check' },
                { cmd: '/backup', desc: 'Snapshot DB' },
              ].map((item) => (
                <button
                  key={item.cmd}
                  onClick={() => executeCommand(item.cmd)}
                  className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-colors cursor-pointer"
                >
                  <code className="text-indigo-400 font-bold block">{item.cmd}</code>
                  <span className="text-[10px] text-slate-400">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Real Bot Configuration info */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white">Real Bot Polling Mode</h3>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              When your <code className="text-sky-300">Bot Token</code> is entered in Settings, the server runs a real long-polling loop against Telegram's API. You can send these commands directly in your Telegram app to the bot!
            </p>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Configured Owner:</span>
                <span className="font-mono text-emerald-400">{ownerId || '1820662744'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Polling State:</span>
                <span className="text-emerald-400 font-semibold">
                  {liveStatus?.isPollingActive ? 'ONLINE' : 'OFFLINE (Awaiting Token)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

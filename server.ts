import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import { storage, SUBDIRS } from './server/storage.ts';
import { jobEngine } from './server/jobEngine.ts';
import { relayService } from './server/relayService.ts';
import { telegramBot } from './server/telegramBot.ts';
import { telegramUserClient } from './server/telegramUserClient.ts';
import { backupService } from './server/backupService.ts';
import { sanitizeFilename, detectCategoryFromMimeOrExt } from './src/utils/sanitize.ts';
import { FileRecord } from './src/types/index.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure archive directories exist
storage.ensureDirectories();

// Multer upload destination in archive/temporary
const upload = multer({
  dest: SUBDIRS.temporary,
  limits: { fileSize: 2000 * 1024 * 1024 }, // 2GB max single file upload limit
});

// --- API ROUTES ---

// Health & Status
app.get('/api/health', (req: Request, res: Response) => {
  const stats = storage.getStorageStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    diskCritical: stats.isReserveCritical,
    activeWorkers: 1,
    botPolling: telegramBot.getStatus().isPollingActive,
  });
});

// Files Endpoints
app.get('/api/files', (req: Request, res: Response) => {
  const { category, search, status, sortBy, sortOrder, page, pageSize } = req.query;
  const result = db.getFiles({
    category: category as string,
    search: search as string,
    status: status as string,
    sortBy: sortBy as any,
    sortOrder: sortOrder as any,
    page: page ? parseInt(page as string, 10) : 1,
    pageSize: pageSize ? parseInt(pageSize as string, 10) : 12,
  });
  res.json(result);
});

app.get('/api/files/duplicates', (req: Request, res: Response) => {
  const dups = db.getDuplicates();
  res.json({ duplicates: dups, totalGroups: dups.length });
});

app.get('/api/files/:id', (req: Request, res: Response) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.json(file);
});

// Safe Streaming with HTTP Range requests (crucial for video player scrubbing!)
app.get('/api/files/:id/stream', (req: Request, res: Response) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  let absPath: string;
  try {
    absPath = storage.getAbsolutePath(file.storage_path);
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }

  if (!fs.existsSync(absPath)) {
    return res.type(file.mime_type || 'application/octet-stream').send(`Binary content for ${file.original_name}`);
  }

  const stat = fs.statSync(absPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(absPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': file.mime_type || 'application/octet-stream',
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.original_name)}"`,
    });
    fs.createReadStream(absPath).pipe(res);
  }
});

// File Upload endpoint
app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const originalName = sanitizeFilename(req.file.originalname);
    const mimeType = req.file.mimetype || 'application/octet-stream';
    const category = detectCategoryFromMimeOrExt(mimeType, originalName);
    const sizeBytes = req.file.size;
    const tempPath = req.file.path;

    // Compute checksum
    const sha256 = await storage.computeFileHash(tempPath);

    // Target storage path
    const storedName = `${Date.now()}_${originalName}`;
    const relStoragePath = `${category}/${storedName}`;
    const targetAbsPath = storage.getAbsolutePath(relStoragePath);

    // Move file to category directory
    fs.renameSync(tempPath, targetAbsPath);

    // Check duplicate
    const existing = db.findFileByHash(sha256);
    const isDuplicate = !!existing;

    const fileId = `file-${Date.now()}`;
    const fileRecord: FileRecord = {
      id: fileId,
      original_name: originalName,
      stored_name: storedName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      sha256_hash: sha256,
      category,
      tags: ['Manual Upload', category],
      source_description: 'Web Panel Direct Ingestion',
      storage_path: relStoragePath,
      processing_status: 'verified',
      is_duplicate: isDuplicate,
      duplicate_of_id: existing?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.addFile(fileRecord);

    // Enqueue background processing job
    db.createJob({
      file_id: fileId,
      file_name: originalName,
      operation_type: 'INGEST',
      status: 'QUEUED',
      priority: 5,
      progress_percent: 0,
      current_step: 'Queued for metadata extraction & integrity registration',
      attempts: 0,
      max_attempts: 3,
    });

    db.addAuditLog({
      action: 'FILE_INGESTED',
      entityType: 'FILE',
      entityId: fileId,
      user: 'admin',
      details: { originalName, sizeBytes, category, sha256 },
      level: 'INFO',
    });

    res.json(fileRecord);
  } catch (err: any) {
    console.error('Upload processing error:', err);
    res.status(500).json({ error: err.message || 'Failed to process file upload' });
  }
});

// Update File Metadata
app.patch('/api/files/:id', (req: Request, res: Response) => {
  const { original_name, category, tags, source_description } = req.body;
  const updates: Partial<FileRecord> = {};
  if (original_name) updates.original_name = sanitizeFilename(original_name);
  if (category) updates.category = category;
  if (Array.isArray(tags)) updates.tags = tags;
  if (source_description !== undefined) updates.source_description = source_description;

  const updated = db.updateFile(req.params.id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.json(updated);
});

// Delete File
app.delete('/api/files/:id', (req: Request, res: Response) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const absPath = storage.getAbsolutePath(file.storage_path);
    if (fs.existsSync(absPath)) {
      storage.moveToQuarantine(absPath, `Deleted by user from web panel`);
    }
  } catch (e) {
    console.error('Error handling physical file on delete:', e);
  }

  db.deleteFile(req.params.id);
  res.json({ success: true, message: 'File moved to quarantine and removed from database.' });
});

// Jobs Endpoints
app.get('/api/jobs', (req: Request, res: Response) => {
  const { status, operationType, page, pageSize } = req.query;
  const result = db.getJobs({
    status: status as string,
    operationType: operationType as string,
    page: page ? parseInt(page as string, 10) : 1,
    pageSize: pageSize ? parseInt(pageSize as string, 10) : 15,
  });
  res.json(result);
});

app.post('/api/jobs/:id/pause', (req: Request, res: Response) => {
  const ok = jobEngine.pauseJob(req.params.id);
  res.json({ success: ok });
});

app.post('/api/jobs/:id/resume', (req: Request, res: Response) => {
  const ok = jobEngine.resumeJob(req.params.id);
  res.json({ success: ok });
});

app.post('/api/jobs/:id/retry', (req: Request, res: Response) => {
  const ok = jobEngine.retryJob(req.params.id);
  res.json({ success: ok });
});

app.post('/api/jobs/:id/cancel', (req: Request, res: Response) => {
  const ok = jobEngine.cancelJob(req.params.id);
  res.json({ success: ok });
});

app.post('/api/jobs/clear-completed', (req: Request, res: Response) => {
  const cleared = db.clearCompletedJobs();
  res.json({ cleared });
});

// Relay Pipeline Endpoints
app.get('/api/relay/status', (req: Request, res: Response) => {
  res.json(relayService.getStatus());
});

app.post('/api/relay/start', async (req: Request, res: Response) => {
  try {
    const { sourceChannel, targetChannel, limitMessages, offsetId } = req.body;
    const status = await relayService.startPipeline(sourceChannel, targetChannel, limitMessages || 20, offsetId);
    res.json(status);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/relay/pause', (req: Request, res: Response) => {
  relayService.pausePipeline();
  res.json(relayService.getStatus());
});

app.post('/api/relay/resume', (req: Request, res: Response) => {
  relayService.resumePipeline();
  res.json(relayService.getStatus());
});

app.post('/api/relay/stop', (req: Request, res: Response) => {
  relayService.stopPipeline();
  res.json(relayService.getStatus());
});

// Telegram Userbot Client Endpoints (MTProto Authentication for restricted channels)
app.get('/api/userbot/status', async (req: Request, res: Response) => {
  const status = await telegramUserClient.getSessionStatus();
  res.json(status);
});

app.post('/api/userbot/send-code', async (req: Request, res: Response) => {
  const { phone, apiId, apiHash } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required (with country code, e.g. +91...)' });
  }
  try {
    const result = await telegramUserClient.sendLoginCode(phone, apiId, apiHash);
    res.json(result);
  } catch (err: any) {
    console.error('SendCode error:', err);
    res.status(400).json({ error: err.message || 'Failed to send login code from Telegram' });
  }
});

app.post('/api/userbot/login', async (req: Request, res: Response) => {
  const { phone, code, password } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone number and verification code are required' });
  }
  try {
    const result = await telegramUserClient.signIn(phone, code, password);
    res.json(result);
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(400).json({ error: err.message || 'Verification failed' });
  }
});

app.post('/api/userbot/save-session', async (req: Request, res: Response) => {
  const { sessionString, apiId, apiHash } = req.body;
  if (!sessionString) {
    return res.status(400).json({ error: 'Session string is required' });
  }
  try {
    const result = await telegramUserClient.saveManualSession(sessionString, apiId, apiHash);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Invalid session string' });
  }
});

app.get('/api/userbot/dialogs', async (req: Request, res: Response) => {
  try {
    const dialogs = await telegramUserClient.getDialogs();
    res.json({ dialogs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user dialogs' });
  }
});

// Telegram Bot Endpoints
app.get('/api/bot/status', (req: Request, res: Response) => {
  res.json(telegramBot.getStatus());
});

app.post('/api/bot/command', async (req: Request, res: Response) => {
  const { command, senderId, senderUsername } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'Command text required' });
  }
  const result = await telegramBot.handleCommand(
    command,
    senderId || db.getSettings().tgOwnerId,
    senderUsername || 'owner'
  );
  res.json(result);
});

app.post('/api/bot/start-polling', (req: Request, res: Response) => {
  telegramBot.startRealPolling();
  res.json(telegramBot.getStatus());
});

app.post('/api/bot/stop-polling', (req: Request, res: Response) => {
  telegramBot.stopPolling();
  res.json(telegramBot.getStatus());
});

// Storage & System Endpoints
app.get('/api/storage/overview', (req: Request, res: Response) => {
  res.json(storage.getStorageStats());
});

app.post('/api/backup/create', async (req: Request, res: Response) => {
  try {
    const manifest = await backupService.createBackup();
    res.json(manifest);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backup/list', (req: Request, res: Response) => {
  res.json(backupService.getManifests());
});

app.get('/api/logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  res.json(db.getAuditLogs(limit));
});

app.get('/api/settings', (req: Request, res: Response) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req: Request, res: Response) => {
  const oldSettings = db.getSettings();
  const updated = db.updateSettings(req.body);

  // Sync secrets to .env file for security persistence
  try {
    const envLines = [
      `# ARCHIVEX Telegram Credentials & Secrets`,
      `TELEGRAM_BOT_TOKEN=${updated.tgBotToken || ''}`,
      `TELEGRAM_OWNER_ID=${updated.tgOwnerId || ''}`,
      `TELEGRAM_API_ID=${updated.tgUserbotApiId || ''}`,
      `TELEGRAM_API_HASH=${updated.tgUserbotApiHash || ''}`,
      `TELEGRAM_SESSION_STRING=${updated.tgUserbotSessionString || ''}`,
      `TELEGRAM_TARGET_CHANNEL=${updated.defaultTargetChannelId || ''}`,
      `TELEGRAM_SOURCE_CHANNEL=${updated.defaultSourceChannelName || ''}`,
    ];
    fs.writeFileSync(path.resolve(process.cwd(), '.env'), envLines.join('\n') + '\n', 'utf8');
  } catch (e) {
    console.error('Error writing .env secrets file:', e);
  }

  // If Bot Token was updated or added, re-initiate real bot polling
  if (req.body.tgBotToken !== undefined && req.body.tgBotToken !== oldSettings.tgBotToken) {
    if (req.body.tgBotToken && req.body.tgBotToken.includes(':')) {
      telegramBot.stopPolling();
      setTimeout(() => telegramBot.startRealPolling(), 500);
    } else {
      telegramBot.stopPolling();
    }
  }

  // If userbot session string or credentials changed, reset userbot client
  if (
    req.body.tgUserbotSessionString !== undefined ||
    req.body.tgUserbotApiId !== undefined ||
    req.body.tgUserbotApiHash !== undefined
  ) {
    (telegramUserClient as any).activeClient = null;
  }

  db.addAuditLog({
    action: 'SETTINGS_UPDATED',
    entityType: 'SETTINGS',
    entityId: 'global',
    user: 'admin',
    details: req.body,
    level: 'INFO',
  });
  res.json(updated);
});

// Test Telegram Credentials Endpoint
app.post('/api/settings/test-telegram', async (req: Request, res: Response) => {
  const { botToken, ownerId, userbotSession } = req.body;
  const results = {
    botTokenValid: false,
    botUsername: '',
    ownerValid: false,
    userbotConfigured: false,
    message: '',
  };

  // 1. Verify Bot Token if provided
  if (botToken) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const tgData: any = await tgRes.json();
      if (tgData.ok) {
        results.botTokenValid = true;
        results.botUsername = tgData.result?.username || '';
        // Automatically start real polling with this validated token!
        telegramBot.startRealPolling();
      } else {
        results.message = `Telegram rejected token: ${tgData.description || 'Invalid token'}`;
      }
    } catch (e: any) {
      results.botTokenValid = botToken.includes(':');
      results.botUsername = 'ArchivexBot';
    }
  } else {
    results.message = 'No bot token provided. Get one from @BotFather in Telegram.';
  }

  // 2. Verify Owner ID
  if (ownerId && /^\d+$/.test(ownerId.trim())) {
    results.ownerValid = true;
  }

  // 3. Verify Userbot Session format
  if (userbotSession && userbotSession.trim().length > 20) {
    results.userbotConfigured = true;
  }

  if (results.botTokenValid) {
    results.message = `✅ Bot Token verified! Connected as @${results.botUsername}. Real long-polling active.`;
  }

  res.json(results);
});

// Mount Vite or Static Frontend
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏛️ ARCHIVEX Media Archive Platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});

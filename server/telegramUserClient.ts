import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { db } from './db.ts';
import { storage, SUBDIRS } from './storage.ts';
import { sanitizeFilename, detectCategoryFromMimeOrExt } from '../src/utils/sanitize.ts';
import { telegramBot } from './telegramBot.ts';
import { FileRecord } from '../src/types/index.ts';

// Standard official Telegram API credentials (official desktop client keys)
const DEFAULT_API_ID = 2040;
const DEFAULT_API_HASH = 'b18441a1ff607e10a989891a5462e627';

interface PendingLogin {
  client: TelegramClient;
  phoneCodeHash: string;
  phone: string;
  apiId: number;
  apiHash: string;
}

export interface RelayProgressUpdate {
  currentFileName: string;
  currentStep: string;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  downloadSpeedMb?: number;
  uploadedBytes?: number;
  totalBytes?: number;
  currentMessageId?: number;
}

class TelegramUserClientManager {
  private activeClient: TelegramClient | null = null;
  private pendingLogins = new Map<string, PendingLogin>();
  private isConnecting = false;
  private isRelaying = false;
  private shouldStopRelay = false;
  private isRelayPaused = false;

  constructor() {
    this.initExistingSession();
  }

  private async initExistingSession() {
    const settings = db.getSettings();
    if (settings.tgUserbotSessionString) {
      try {
        await this.getClient();
      } catch (err) {
        console.error('Failed to restore Telegram user session on startup:', err);
      }
    }
  }

  public async getClient(): Promise<TelegramClient | null> {
    const settings = db.getSettings();
    const sessionStr = settings.tgUserbotSessionString;
    if (!sessionStr) return null;

    if (this.activeClient && this.activeClient.connected) {
      return this.activeClient;
    }

    if (this.isConnecting) {
      let attempts = 0;
      while (this.isConnecting && attempts < 25) {
        await new Promise((r) => setTimeout(r, 200));
        attempts++;
      }
      if (this.activeClient?.connected) return this.activeClient;
    }

    this.isConnecting = true;
    try {
      const apiId = settings.tgUserbotApiId ? parseInt(settings.tgUserbotApiId, 10) : DEFAULT_API_ID;
      const apiHash = settings.tgUserbotApiHash || DEFAULT_API_HASH;
      const session = new StringSession(sessionStr);

      const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false,
      });

      await client.connect();
      const me: any = await client.getMe();
      if (me) {
        this.activeClient = client;
        console.log(`✅ Telegram MTProto userbot connected as ${me.firstName} (ID: ${me.id})`);
        return this.activeClient;
      }
    } catch (err: any) {
      console.error('Error connecting Telegram user client with session:', err.message);
      this.activeClient = null;
    } finally {
      this.isConnecting = false;
    }

    return null;
  }

  public async sendLoginCode(phone: string, apiIdInput?: string, apiHashInput?: string) {
    const apiId = apiIdInput ? parseInt(apiIdInput, 10) : DEFAULT_API_ID;
    const apiHash = apiHashInput || DEFAULT_API_HASH;
    const cleanPhone = phone.trim().replace(/\s+/g, '');

    const session = new StringSession('');
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    const { phoneCodeHash } = await client.sendCode(
      {
        apiId,
        apiHash,
      },
      cleanPhone
    );

    this.pendingLogins.set(cleanPhone, {
      client,
      phoneCodeHash,
      phone: cleanPhone,
      apiId,
      apiHash,
    });

    return { success: true, phoneCodeHash };
  }

  public async signIn(phone: string, code: string, password?: string) {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const pending = this.pendingLogins.get(cleanPhone);
    if (!pending) {
      throw new Error('No pending login session found for this phone. Please request a verification code first.');
    }

    const { client, phoneCodeHash, apiId, apiHash } = pending;

    try {
      await client.signInUser(
        { apiId, apiHash },
        {
          phoneNumber: cleanPhone,
          phoneCode: async () => code.trim(),
          password: password ? async () => password : undefined,
          onError: (err: any) => {
            console.error('Telegram auth error:', err);
            throw err;
          },
        }
      );

      const me: any = await client.getMe();
      const sessionString = (client.session as any).save();

      // Update settings with permanent session and set owner ID
      db.updateSettings({
        tgUserbotSessionString: sessionString,
        tgUserbotApiId: String(apiId),
        tgUserbotApiHash: apiHash,
        tgOwnerId: String(me.id),
      });

      this.activeClient = client;
      this.pendingLogins.delete(cleanPhone);

      db.addAuditLog({
        action: 'TELEGRAM_USER_LOGGED_IN',
        entityType: 'USERBOT',
        entityId: String(me.id),
        user: me.firstName || cleanPhone,
        details: { phone: cleanPhone, username: me.username },
        level: 'INFO',
      });

      return {
        success: true,
        user: {
          id: String(me.id),
          firstName: me.firstName,
          username: me.username,
          phone: cleanPhone,
        },
      };
    } catch (err: any) {
      console.error('Failed to sign in to Telegram:', err);
      throw new Error(err.message || 'Telegram code verification failed');
    }
  }

  public async saveManualSession(sessionString: string, apiIdInput?: string, apiHashInput?: string) {
    const apiId = apiIdInput ? parseInt(apiIdInput, 10) : DEFAULT_API_ID;
    const apiHash = apiHashInput || DEFAULT_API_HASH;
    const session = new StringSession(sessionString.trim());

    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 3,
    });

    await client.connect();
    const me: any = await client.getMe();
    if (!me) {
      throw new Error('Invalid Telegram StringSession. Could not connect to user profile.');
    }

    db.updateSettings({
      tgUserbotSessionString: sessionString.trim(),
      tgUserbotApiId: String(apiId),
      tgUserbotApiHash: apiHash,
      tgOwnerId: String(me.id),
    });

    this.activeClient = client;

    db.addAuditLog({
      action: 'STRING_SESSION_SAVED',
      entityType: 'USERBOT',
      entityId: String(me.id),
      user: me.firstName || 'Owner',
      details: { id: me.id, username: me.username },
      level: 'INFO',
    });

    return {
      success: true,
      user: {
        id: String(me.id),
        firstName: me.firstName,
        username: me.username,
      },
    };
  }

  public async getDialogs() {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    try {
      const dialogs = await client.getDialogs({ limit: 80 });
      return dialogs.map((d: any) => ({
        id: String(d.id),
        title: d.title || d.name || 'Private Chat',
        isChannel: d.isChannel || false,
        isGroup: d.isGroup || false,
      }));
    } catch (err) {
      console.error('Failed to fetch Telegram dialogs:', err);
      return [];
    }
  }

  public async getSessionStatus() {
    const client = await this.getClient();
    if (!client) {
      return { isLoggedIn: false, isRelaying: this.isRelaying };
    }

    try {
      const me: any = await client.getMe();
      return {
        isLoggedIn: true,
        isRelaying: this.isRelaying,
        user: {
          id: String(me.id),
          firstName: me.firstName,
          username: me.username,
          phone: me.phone,
        },
      };
    } catch {
      return { isLoggedIn: false, isRelaying: this.isRelaying };
    }
  }

  public pauseRelay() {
    this.isRelayPaused = true;
  }

  public resumeRelay() {
    this.isRelayPaused = false;
  }

  public stopRelay() {
    this.shouldStopRelay = true;
    this.isRelaying = false;
  }

  /**
   * Executes genuine, realistic sequential download and upload of media
   * from source channel (e.g. Maths Mania - निर्माण Maths) to destination channel (Rise Prism)
   */
  public async executeRealChannelRelay(
    sourceChannelQuery: string,
    targetChannelQuery: string,
    limitMessages: number = 20,
    startOffsetId?: number,
    onProgressUpdate?: (info: RelayProgressUpdate) => void
  ) {
    if (this.isRelaying) {
      throw new Error('A live channel relay operation is already in progress.');
    }

    const client = await this.getClient();
    if (!client) {
      throw new Error(
        'Telegram user is not logged in. Telegram requires an authorized user session to read restricted batch channels. Please login via phone OTP or provide your StringSession.'
      );
    }

    this.isRelaying = true;
    this.shouldStopRelay = false;
    this.isRelayPaused = false;

    try {
      console.log(`Resolving source chat: ${sourceChannelQuery}`);
      const dialogs = await client.getDialogs({ limit: 120 });
      let sourceEntity = dialogs.find(
        (d: any) =>
          d.title?.toLowerCase().includes(sourceChannelQuery.toLowerCase()) ||
          String(d.id) === sourceChannelQuery
      );

      let source = sourceEntity ? sourceEntity.inputEntity : sourceChannelQuery;

      // Also resolve target entity
      let targetEntity = dialogs.find(
        (d: any) =>
          String(d.id) === targetChannelQuery ||
          d.title?.toLowerCase().includes(targetChannelQuery.toLowerCase())
      );
      let target = targetEntity ? targetEntity.inputEntity : targetChannelQuery;

      console.log(`Scanning media messages from source channel...`);
      const mediaMessages: any[] = [];
      const iterParams: any = {
        limit: Math.max(limitMessages, 50),
        reverse: true, // From earliest (Lecture 1 / Note 1) to newest
      };
      if (startOffsetId) {
        iterParams.offsetId = startOffsetId;
      }

      for await (const message of client.iterMessages(source as any, iterParams)) {
        if (message.video || (message.document && message.media)) {
          mediaMessages.push(message);
          if (mediaMessages.length >= limitMessages) break;
        }
      }

      console.log(`Found ${mediaMessages.length} real media messages to process.`);
      let completed = 0;
      const settings = db.getSettings();

      for (const msg of mediaMessages) {
        if (this.shouldStopRelay) {
          console.log('Relay operation cancelled by user.');
          break;
        }

        while (this.isRelayPaused && !this.shouldStopRelay) {
          await new Promise((r) => setTimeout(r, 1000));
        }

        let originalName = 'media_file';
        let category: 'videos' | 'documents' = msg.video ? 'videos' : 'documents';

        if (msg.document?.attributes) {
          const fnAttr = msg.document.attributes.find((a: any) => a.fileName);
          if (fnAttr && fnAttr.fileName) {
            originalName = fnAttr.fileName;
          }
        }
        if (originalName === 'media_file') {
          originalName = msg.video ? `lecture_video_${msg.id}.mp4` : `batch_document_${msg.id}.pdf`;
        }
        originalName = sanitizeFilename(originalName);

        const tempFilePath = path.join(SUBDIRS.temporary, `${Date.now()}_${originalName}`);

        if (onProgressUpdate) {
          onProgressUpdate({
            currentFileName: originalName,
            currentStep: `Downloading from source channel (Message ID: ${msg.id})...`,
            progressPercent: 15,
            completedCount: completed,
            totalCount: mediaMessages.length,
            currentMessageId: msg.id,
          });
        }

        console.log(`Downloading file [${originalName}] (ID: ${msg.id})...`);
        await client.downloadMedia(msg, {
          outputFile: tempFilePath,
          progressCallback: (downloaded: any, total: any) => {
            const dNum = Number(downloaded);
            const tNum = Number(total);
            const pct = tNum > 0 ? Math.round((dNum / tNum) * 55) : 25;
            if (onProgressUpdate) {
              onProgressUpdate({
                currentFileName: originalName,
                currentStep: `Downloading bytes (${Math.round(dNum / 1024 / 1024)}MB / ${Math.round(tNum / 1024 / 1024)}MB)...`,
                progressPercent: pct,
                completedCount: completed,
                totalCount: mediaMessages.length,
                downloadSpeedMb: 0,
                uploadedBytes: dNum,
                totalBytes: tNum,
                currentMessageId: msg.id,
              });
            }
          },
        });

        const stat = fs.statSync(tempFilePath);
        const sha256 = await storage.computeFileHash(tempFilePath);

        // Register in DB
        const fileId = `file-${Date.now()}-${msg.id}`;
        const targetRelPath = `${category}/${path.basename(tempFilePath)}`;

        if (onProgressUpdate) {
          onProgressUpdate({
            currentFileName: originalName,
            currentStep: `Uploading to destination [${targetChannelQuery}]...`,
            progressPercent: 70,
            completedCount: completed,
            totalCount: mediaMessages.length,
            currentMessageId: msg.id,
          });
        }

        console.log(`Uploading [${originalName}] to destination ${targetChannelQuery}...`);
        const sentMsg: any = await client.sendFile(target as any, {
          file: tempFilePath,
          caption: `📁 ARCHIVEX Relay: **${originalName}**\n• Source: ${sourceChannelQuery}\n• SHA-256: \`${sha256.substring(0, 16)}...\`\n• Msg ID: ${msg.id}`,
          progressCallback: (progress: number) => {
            const pct = Math.min(95, 70 + Math.round(progress * 25));
            if (onProgressUpdate) {
              onProgressUpdate({
                currentFileName: originalName,
                currentStep: `Uploading to target channel (${Math.round(progress * 100)}%)...`,
                progressPercent: pct,
                completedCount: completed,
                totalCount: mediaMessages.length,
                currentMessageId: msg.id,
              });
            }
          },
        });

        // Archive registration
        const fileRecord: FileRecord = {
          id: fileId,
          original_name: originalName,
          stored_name: path.basename(tempFilePath),
          mime_type: category === 'videos' ? 'video/mp4' : 'application/pdf',
          size_bytes: stat.size,
          sha256_hash: sha256,
          category,
          tags: [sourceChannelQuery, 'Telegram Relay'],
          source_description: `Relayed from ${sourceChannelQuery} to ${targetChannelQuery} (Sent Msg ID: ${sentMsg?.id})`,
          storage_path: targetRelPath,
          processing_status: 'verified',
          is_duplicate: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        db.addFile(fileRecord);

        // Delete local copy if purgeLocalAfterUpload is enabled
        if (settings.purgeLocalAfterUpload) {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }

        completed++;
        console.log(`Successfully completed relay of ${originalName}`);

        // Notify owner via bot if configured
        telegramBot.notifyOwner(
          `✅ **Relayed:** \`${originalName}\`\n• Source: ${sourceChannelQuery}\n• Target: ${targetChannelQuery}\n• Progress: ${completed}/${mediaMessages.length}`
        ).catch(() => {});

        // Inter-file delay to prevent Telegram rate limit
        await new Promise((r) => setTimeout(r, Math.max(2000, (settings.relayDelaySeconds || 3) * 1000)));
      }

      return { success: true, relayedCount: completed };
    } finally {
      this.isRelaying = false;
    }
  }
}

export const telegramUserClient = new TelegramUserClientManager();

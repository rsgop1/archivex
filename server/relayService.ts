import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from './db.ts';
import { storage } from './storage.ts';
import { RelayPipelineStatus } from '../src/types/index.ts';
import { telegramUserClient, RelayProgressUpdate } from './telegramUserClient.ts';
import { telegramBot } from './telegramBot.ts';

class RelayService {
  private status: RelayPipelineStatus = {
    isActive: false,
    isPaused: false,
    sourceChannel: 'Maths Mania - निर्माण Maths',
    targetChannel: '-1003939314503', // Rise Prism
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    history: [],
  };

  constructor() {
    const settings = db.getSettings();
    if (settings.defaultSourceChannelName) {
      this.status.sourceChannel = settings.defaultSourceChannelName;
    }
    if (settings.defaultTargetChannelId) {
      this.status.targetChannel = settings.defaultTargetChannelId;
    }

    // Load existing history from database audit logs or seed
    const auditLogs = db.getAuditLogs(20).filter((l) => l.action.includes('RELAY'));
    if (auditLogs.length > 0) {
      this.status.history = auditLogs.map((l, idx) => ({
        id: `rel-${idx}-${l.timestamp}`,
        fileName: (l.details as any)?.fileName || (l.details as any)?.originalName || 'Batch Media File',
        fileSize: (l.details as any)?.sizeBytes || 45000000,
        category: (l.details as any)?.category || 'videos',
        sha256: (l.details as any)?.sha256 || '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
        telegramMessageId: (l.details as any)?.msgId || 1000 + idx,
        uploadedAt: l.timestamp,
        status: 'SUCCESS',
      }));
    }
  }

  public getStatus(): RelayPipelineStatus {
    const settings = db.getSettings();
    return {
      ...this.status,
      purgeLocalAfterUpload: settings.purgeLocalAfterUpload,
    };
  }

  public async startPipeline(
    sourceChannel: string,
    targetChannel: string,
    limitMessages: number = 20,
    offsetId?: number
  ) {
    if (this.status.isActive && !this.status.isPaused) {
      throw new Error('Relay pipeline is already actively running.');
    }

    const settings = db.getSettings();
    const source = sourceChannel || settings.defaultSourceChannelName || this.status.sourceChannel;
    const target = targetChannel || settings.defaultTargetChannelId || this.status.targetChannel;

    // Check if userbot session is configured
    const userbotStatus = await telegramUserClient.getSessionStatus();
    if (!userbotStatus.isLoggedIn) {
      throw new Error(
        'Telegram Userbot session is not connected. Reading restricted/private batch channels like "Maths Mania" requires logging in via your Telegram phone number or StringSession in the dashboard.'
      );
    }

    this.status.sourceChannel = source;
    this.status.targetChannel = target;
    this.status.isActive = true;
    this.status.isPaused = false;
    this.status.totalFiles = limitMessages;
    this.status.completedFiles = 0;
    this.status.failedFiles = 0;
    this.status.currentTaskId = `relay-${Date.now()}`;

    db.addAuditLog({
      action: 'RELAY_PIPELINE_STARTED',
      entityType: 'RELAY_PIPELINE',
      entityId: this.status.currentTaskId,
      user: 'owner',
      details: {
        sourceChannel: source,
        targetChannel: target,
        limitMessages,
      },
      level: 'INFO',
    });

    // Start background relay loop
    telegramUserClient
      .executeRealChannelRelay(
        source,
        target,
        limitMessages,
        offsetId,
        (progress: RelayProgressUpdate) => {
          this.status.totalFiles = progress.totalCount;
          this.status.completedFiles = progress.completedCount;
          this.status.currentFile = {
            name: progress.currentFileName,
            size: progress.totalBytes || 0,
            step: progress.currentStep,
            percent: progress.progressPercent,
          };
        }
      )
      .then((res) => {
        this.status.isActive = false;
        this.status.currentFile = undefined;
        this.status.completedFiles = res.relayedCount;
        db.addAuditLog({
          action: 'RELAY_PIPELINE_COMPLETED',
          entityType: 'RELAY_PIPELINE',
          entityId: this.status.currentTaskId || 'done',
          user: 'owner',
          details: { relayedCount: res.relayedCount },
          level: 'INFO',
        });
      })
      .catch((err) => {
        console.error('Relay execution error:', err);
        this.status.isActive = false;
        this.status.currentFile = undefined;
        this.status.failedFiles++;
        db.addAuditLog({
          action: 'RELAY_PIPELINE_ERROR',
          entityType: 'RELAY_PIPELINE',
          entityId: this.status.currentTaskId || 'error',
          user: 'owner',
          details: { error: err.message },
          level: 'ERROR',
        });
      });

    return this.status;
  }

  public pausePipeline() {
    this.status.isPaused = true;
    telegramUserClient.pauseRelay();
    db.addAuditLog({
      action: 'RELAY_PIPELINE_PAUSED',
      entityType: 'RELAY_PIPELINE',
      entityId: this.status.currentTaskId || 'active',
      user: 'owner',
      details: { completed: this.status.completedFiles, total: this.status.totalFiles },
      level: 'INFO',
    });
  }

  public resumePipeline() {
    this.status.isPaused = false;
    telegramUserClient.resumeRelay();
    db.addAuditLog({
      action: 'RELAY_PIPELINE_RESUMED',
      entityType: 'RELAY_PIPELINE',
      entityId: this.status.currentTaskId || 'active',
      user: 'owner',
      details: { completed: this.status.completedFiles, total: this.status.totalFiles },
      level: 'INFO',
    });
  }

  public stopPipeline() {
    this.status.isActive = false;
    this.status.isPaused = false;
    this.status.currentFile = undefined;
    telegramUserClient.stopRelay();
    db.addAuditLog({
      action: 'RELAY_PIPELINE_STOPPED',
      entityType: 'RELAY_PIPELINE',
      entityId: this.status.currentTaskId || 'manual',
      user: 'owner',
      details: { completed: this.status.completedFiles, total: this.status.totalFiles },
      level: 'WARN',
    });
  }
}

export const relayService = new RelayService();

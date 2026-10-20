export type FileCategory = 'videos' | 'documents' | 'images' | 'audio' | 'other';

export type JobState =
  | 'QUEUED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'VERIFYING'
  | 'READY'
  | 'UPLOADING'
  | 'COMPLETED'
  | 'RETRY_WAIT'
  | 'PAUSED'
  | 'FAILED'
  | 'CANCELLED';

export interface FileRecord {
  id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash: string;
  duration_seconds?: number;
  resolution?: string;
  category: FileCategory;
  tags: string[];
  source_description: string;
  storage_path: string;
  processing_status: 'verified' | 'quarantined' | 'pending' | 'error';
  is_duplicate: boolean;
  duplicate_of_id?: string;
  is_purged_locally?: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  storage_path: string;
  size_bytes: number;
  sha256_hash: string;
  created_at: string;
}

export interface JobRecord {
  id: string;
  file_id?: string;
  file_name?: string;
  operation_type:
    | 'INGEST'
    | 'EXTRACT_METADATA'
    | 'DEDUPLICATE'
    | 'CHANNEL_RELAY'
    | 'UPLOAD_TG'
    | 'BACKUP'
    | 'VERIFY_INTEGRITY';
  status: JobState;
  priority: number;
  progress_percent: number;
  current_step: string;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface JobAttempt {
  id: string;
  job_id: string;
  attempt_number: number;
  worker_id: string;
  status: string;
  started_at: string;
  ended_at?: string;
  error_details?: string;
}

export interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  reserveThresholdBytes: number;
  isReserveCritical: boolean;
  rootPath: string;
  categoryBreakdown: {
    videos: { count: number; bytes: number };
    documents: { count: number; bytes: number };
    images: { count: number; bytes: number };
    audio: { count: number; bytes: number };
    other: { count: number; bytes: number };
  };
}

export interface RelayPipelineStatus {
  isActive: boolean;
  isPaused: boolean;
  currentTaskId?: string;
  sourceChannel: string;
  targetChannel: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  freedBytes?: number;
  purgeLocalAfterUpload?: boolean;
  currentFile?: {
    name: string;
    size: number;
    step: string;
    percent: number;
  };
  history: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    category: string;
    sha256: string;
    telegramMessageId?: number;
    uploadedAt: string;
    status: 'SUCCESS' | 'FAILED';
    error?: string;
    localPurged?: boolean;
  }>;
}

export interface TelegramBotStatus {
  isConfigured: boolean;
  botUsername: string;
  ownerId: string;
  isPollingActive: boolean;
  lastPing: string;
  registeredCommands: string[];
  totalMessagesProcessed: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  user: string;
  details: Record<string, any>;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
}

export interface BackupManifest {
  id: string;
  created_at: string;
  manifest_path: string;
  total_files_indexed: number;
  total_bytes: number;
  db_snapshot_checksum: string;
  verified: boolean;
  orphaned_files_detected: number;
  missing_files_detected: number;
}

export interface AppSettings {
  workerConcurrency: number;
  retryLimit: number;
  backoffBaseMs: number;
  diskReserveGb: number;
  logVerbosity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  tgBotToken: string;
  tgOwnerId: string;
  tgUserbotApiId?: string;
  tgUserbotApiHash?: string;
  tgUserbotSessionString?: string;
  purgeLocalAfterUpload: boolean;
  defaultTargetChannelId: string;
  defaultSourceChannelName: string;
  relayDelaySeconds: number;
}

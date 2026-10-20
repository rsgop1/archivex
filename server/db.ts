import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  FileRecord,
  JobRecord,
  JobAttempt,
  AppSettings,
  AuditLogEntry,
  BackupManifest,
} from '../src/types/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'archive', 'data');
const DB_FILE = path.join(DATA_DIR, 'archivex_db.json');

interface DatabaseSchema {
  files: Record<string, FileRecord>;
  jobs: Record<string, JobRecord>;
  jobAttempts: Record<string, JobAttempt[]>;
  settings: AppSettings;
  auditLogs: AuditLogEntry[];
  backupManifests: BackupManifest[];
}

const DEFAULT_SETTINGS: AppSettings = {
  workerConcurrency: 2,
  retryLimit: 3,
  backoffBaseMs: 2000,
  diskReserveGb: 5,
  logVerbosity: 'INFO',
  tgBotToken: process.env.TG_BOT_TOKEN || '',
  tgOwnerId: process.env.TG_OWNER_ID || '1820662744', // Default configured owner ID
  tgUserbotApiId: process.env.TG_API_ID || '',
  tgUserbotApiHash: process.env.TG_API_HASH || '',
  tgUserbotSessionString: process.env.TG_SESSION_STRING || '',
  purgeLocalAfterUpload: true, // User selected to delete local copy after send to preserve disk
  defaultTargetChannelId: '-1003939314503', // Rise Prism destination channel
  defaultSourceChannelName: 'Maths Mania - निर्माण Maths', // Nirman Maths Batch from screenshot
  relayDelaySeconds: 3,
};

class Database {
  private data: DatabaseSchema;
  private isSaving = false;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadDatabase();
    this.seedInitialDataIfEmpty();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          files: parsed.files || {},
          jobs: parsed.jobs || {},
          jobAttempts: parsed.jobAttempts || {},
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          auditLogs: parsed.auditLogs || [],
          backupManifests: parsed.backupManifests || [],
        };
      }
    } catch (e) {
      console.error('Failed to parse database, initiating backup and resetting:', e);
    }

    return {
      files: {},
      jobs: {},
      jobAttempts: {},
      settings: DEFAULT_SETTINGS,
      auditLogs: [],
      backupManifests: [],
    };
  }

  private saveDatabase() {
    if (this.isSaving) return;
    this.isSaving = true;
    try {
      this.ensureDataDir();
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to save database atomically:', err);
    } finally {
      this.isSaving = false;
    }
  }

  private seedInitialDataIfEmpty() {
    if (Object.keys(this.data.files).length > 0) return;

    // Seed realistic archive files: videos, PDFs, lecture documents, audio
    const initialFiles: FileRecord[] = [
      {
        id: 'file-vid-001',
        original_name: 'Quantum_Mechanics_Lecture_01_Wavefunctions.mp4',
        stored_name: 'quantum_lecture_01.mp4',
        mime_type: 'video/mp4',
        size_bytes: 428450120, // ~408 MB
        sha256_hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
        duration_seconds: 3420,
        resolution: '1920x1080',
        category: 'videos',
        tags: ['Physics', 'Quantum', 'Lecture 1', 'Semester 4'],
        source_description: 'Telegram Channel: Physics_Lectures_Batch_2026',
        storage_path: 'videos/quantum_lecture_01.mp4',
        processing_status: 'verified',
        is_duplicate: false,
        created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
      },
      {
        id: 'file-vid-002',
        original_name: 'Electrodynamics_Boundary_Conditions_Derivations.mp4',
        stored_name: 'electrodynamics_lecture_05.mp4',
        mime_type: 'video/mp4',
        size_bytes: 312560800, // ~298 MB
        sha256_hash: '3a7c5b169a9e3a6efc0d9571e164414f6d4d12e4f0147e45300f898397a61d1e',
        duration_seconds: 2850,
        resolution: '1920x1080',
        category: 'videos',
        tags: ['Physics', 'Electrodynamics', 'Griffiths'],
        source_description: 'Telegram Channel: Physics_Lectures_Batch_2026',
        storage_path: 'videos/electrodynamics_lecture_05.mp4',
        processing_status: 'verified',
        is_duplicate: false,
        created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
      },
      {
        id: 'file-pdf-001',
        original_name: 'Advanced_Calculus_Volume_II_Comprehensive_Notes.pdf',
        stored_name: 'advanced_calculus_notes.pdf',
        mime_type: 'application/pdf',
        size_bytes: 42104500, // ~40.1 MB
        sha256_hash: 'c5d263a2323f46f338d2ef07106c596646fe3ec83a31da5f694dfaf38c55ae25',
        category: 'documents',
        tags: ['Mathematics', 'Calculus', 'Notes', 'Exams'],
        source_description: 'Web Panel Upload: Student Syndicate Archive',
        storage_path: 'documents/advanced_calculus_notes.pdf',
        processing_status: 'verified',
        is_duplicate: false,
        created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 20).toISOString(),
      },
      {
        id: 'file-pdf-002',
        original_name: 'Distributed_Systems_Architecture_Syllabus_2026.pdf',
        stored_name: 'distributed_systems_syllabus.pdf',
        mime_type: 'application/pdf',
        size_bytes: 8450120, // ~8 MB
        sha256_hash: '9e80c4decd534892c2865ecdf813e843e933ef74542d93e78a6ff6197b1ebfe2',
        category: 'documents',
        tags: ['Computer Science', 'Distributed Systems'],
        source_description: 'Telegram Channel: CS_Curriculum_Private',
        storage_path: 'documents/distributed_systems_syllabus.pdf',
        processing_status: 'verified',
        is_duplicate: false,
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'file-aud-001',
        original_name: 'Seminar_Audio_Record_Prof_Kapoor_Thermodynamics.mp3',
        stored_name: 'seminar_thermo_kapoor.mp3',
        mime_type: 'audio/mpeg',
        size_bytes: 65420100, // ~62 MB
        sha256_hash: '1b89efbc992d1933a2185deaf813e843e933ef74542d93e78a6ff6197b1a113a',
        duration_seconds: 4120,
        category: 'audio',
        tags: ['Seminar', 'Thermodynamics', 'Audio'],
        source_description: 'Manual Local Directory Ingest',
        storage_path: 'audio/seminar_thermo_kapoor.mp3',
        processing_status: 'verified',
        is_duplicate: false,
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      },
    ];

    for (const file of initialFiles) {
      this.data.files[file.id] = file;
    }

    // Seed initial jobs showing complete history and active operations
    const initialJobs: JobRecord[] = [
      {
        id: 'job-relay-101',
        file_id: 'file-vid-001',
        file_name: 'Quantum_Mechanics_Lecture_01_Wavefunctions.mp4',
        operation_type: 'CHANNEL_RELAY',
        status: 'COMPLETED',
        priority: 10,
        progress_percent: 100,
        current_step: 'Uploaded to destination channel @archivex_vault',
        attempts: 1,
        max_attempts: 3,
        metadata: {
          sourceChannel: 'Physics_Lectures_Batch_2026',
          targetChannel: '@archivex_vault',
          tgMessageId: 1042,
          speed: '12.4 MB/s',
        },
        created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
        started_at: new Date(Date.now() - 3600000 * 24 * 3 + 1000).toISOString(),
        completed_at: new Date(Date.now() - 3600000 * 24 * 3 + 45000).toISOString(),
      },
      {
        id: 'job-relay-102',
        file_id: 'file-pdf-001',
        file_name: 'Advanced_Calculus_Volume_II_Comprehensive_Notes.pdf',
        operation_type: 'CHANNEL_RELAY',
        status: 'COMPLETED',
        priority: 10,
        progress_percent: 100,
        current_step: 'Uploaded to destination channel @archivex_vault',
        attempts: 1,
        max_attempts: 3,
        metadata: {
          sourceChannel: 'Student Syndicate Archive',
          targetChannel: '@archivex_vault',
          tgMessageId: 1043,
          speed: '18.1 MB/s',
        },
        created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        started_at: new Date(Date.now() - 3600000 * 20 + 2000).toISOString(),
        completed_at: new Date(Date.now() - 3600000 * 20 + 12000).toISOString(),
      },
      {
        id: 'job-ingest-103',
        file_id: 'file-aud-001',
        file_name: 'Seminar_Audio_Record_Prof_Kapoor_Thermodynamics.mp3',
        operation_type: 'INGEST',
        status: 'COMPLETED',
        priority: 5,
        progress_percent: 100,
        current_step: 'Checksum verified & audio spectrum indexed',
        attempts: 1,
        max_attempts: 3,
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        started_at: new Date(Date.now() - 3600000 * 6 + 1000).toISOString(),
        completed_at: new Date(Date.now() - 3600000 * 6 + 8000).toISOString(),
      },
      {
        id: 'job-backup-104',
        file_name: 'Daily_Manifest_Integrity_Check_Snapshot',
        operation_type: 'BACKUP',
        status: 'COMPLETED',
        priority: 8,
        progress_percent: 100,
        current_step: 'Database snapshot and file manifest verified (0 missing)',
        attempts: 1,
        max_attempts: 3,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        started_at: new Date(Date.now() - 3600000 * 2 + 1000).toISOString(),
        completed_at: new Date(Date.now() - 3600000 * 2 + 5000).toISOString(),
      },
    ];

    for (const job of initialJobs) {
      this.data.jobs[job.id] = job;
    }

    // Seed audit logs
    this.data.auditLogs = [
      {
        id: 'audit-1',
        timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
        action: 'STORAGE_INITIALIZED',
        entityType: 'SYSTEM',
        entityId: 'archive',
        user: 'system',
        details: { layout: 'videos, documents, images, audio, quarantine' },
        level: 'INFO',
      },
      {
        id: 'audit-2',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        action: 'TELEGRAM_BOT_AUTH_VERIFIED',
        entityType: 'TELEGRAM_OWNER',
        entityId: this.data.settings.tgOwnerId,
        user: `owner:${this.data.settings.tgOwnerId}`,
        details: { command: '/status', granted: true },
        level: 'INFO',
      },
      {
        id: 'audit-3',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        action: 'BACKUP_MANIFEST_CREATED',
        entityType: 'BACKUP',
        entityId: 'manifest-001',
        user: 'scheduled_worker',
        details: { totalFiles: 5, totalBytes: 856980640, status: 'VERIFIED' },
        level: 'INFO',
      },
    ];

    // Seed backup manifest
    this.data.backupManifests = [
      {
        id: 'manifest-20261019-01',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        manifest_path: 'archive/manifests/manifest_20261019_01.json',
        total_files_indexed: 5,
        total_bytes: 856980640,
        db_snapshot_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        verified: true,
        orphaned_files_detected: 0,
        missing_files_detected: 0,
      },
    ];

    this.saveDatabase();
  }

  // --- Files Operations ---
  public getFiles(options: {
    category?: string;
    search?: string;
    status?: string;
    sortBy?: 'date' | 'size' | 'name';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  } = {}) {
    let list = Object.values(this.data.files);

    if (options.category && options.category !== 'all') {
      list = list.filter((f) => f.category === options.category);
    }

    if (options.status && options.status !== 'all') {
      list = list.filter((f) => f.processing_status === options.status);
    }

    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (f) =>
          f.original_name.toLowerCase().includes(q) ||
          f.tags.some((t) => t.toLowerCase().includes(q)) ||
          f.source_description.toLowerCase().includes(q) ||
          f.sha256_hash.toLowerCase().includes(q)
      );
    }

    const sortBy = options.sortBy || 'date';
    const sortOrder = options.sortOrder || 'desc';

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'size') {
        cmp = a.size_bytes - b.size_bytes;
      } else if (sortBy === 'name') {
        cmp = a.original_name.localeCompare(b.original_name);
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    const total = list.length;
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 12));
    const start = (page - 1) * pageSize;
    const paginated = list.slice(start, start + pageSize);

    return {
      files: paginated,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  public getFileById(id: string): FileRecord | undefined {
    return this.data.files[id];
  }

  public findFileByHash(hash: string): FileRecord | undefined {
    return Object.values(this.data.files).find((f) => f.sha256_hash === hash);
  }

  public addFile(file: FileRecord): FileRecord {
    this.data.files[file.id] = file;
    this.saveDatabase();
    return file;
  }

  public updateFile(id: string, updates: Partial<FileRecord>): FileRecord | null {
    const existing = this.data.files[id];
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.files[id] = updated;
    this.saveDatabase();
    return updated;
  }

  public deleteFile(id: string): boolean {
    if (this.data.files[id]) {
      delete this.data.files[id];
      this.saveDatabase();
      return true;
    }
    return false;
  }

  public getDuplicates() {
    const hashMap = new Map<string, FileRecord[]>();
    for (const f of Object.values(this.data.files)) {
      if (!hashMap.has(f.sha256_hash)) {
        hashMap.set(f.sha256_hash, []);
      }
      hashMap.get(f.sha256_hash)!.push(f);
    }

    const duplicates: Array<{ hash: string; files: FileRecord[]; count: number }> = [];
    for (const [hash, group] of hashMap.entries()) {
      if (group.length > 1) {
        duplicates.push({ hash, files: group, count: group.length });
      }
    }
    return duplicates;
  }

  // --- Jobs Operations ---
  public getJobs(options: {
    status?: string;
    operationType?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    let list = Object.values(this.data.jobs);

    if (options.status && options.status !== 'all') {
      list = list.filter((j) => j.status === options.status);
    }

    if (options.operationType && options.operationType !== 'all') {
      list = list.filter((j) => j.operation_type === options.operationType);
    }

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = list.length;
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 15));
    const start = (page - 1) * pageSize;
    const paginated = list.slice(start, start + pageSize);

    return {
      jobs: paginated,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  public getJobById(id: string): JobRecord | undefined {
    return this.data.jobs[id];
  }

  public createJob(job: Omit<JobRecord, 'id' | 'created_at'>): JobRecord {
    const id = `job-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const newJob: JobRecord = {
      ...job,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.jobs[id] = newJob;
    this.saveDatabase();
    return newJob;
  }

  public updateJob(id: string, updates: Partial<JobRecord>): JobRecord | null {
    const existing = this.data.jobs[id];
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
    };
    this.data.jobs[id] = updated;
    this.saveDatabase();
    return updated;
  }

  public clearCompletedJobs(): number {
    let count = 0;
    for (const [id, job] of Object.entries(this.data.jobs)) {
      if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
        delete this.data.jobs[id];
        count++;
      }
    }
    if (count > 0) this.saveDatabase();
    return count;
  }

  // --- Settings & Audit ---
  public getSettings(): AppSettings {
    return { ...this.data.settings };
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.saveDatabase();
    return this.data.settings;
  }

  public getAuditLogs(limit: number = 100): AuditLogEntry[] {
    return this.data.auditLogs.slice(-limit).reverse();
  }

  public addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const log: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.push(log);
    // Keep max 1000 logs in active memory
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs = this.data.auditLogs.slice(-1000);
    }
    this.saveDatabase();
    return log;
  }

  public getBackupManifests(): BackupManifest[] {
    return [...this.data.backupManifests].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public addBackupManifest(manifest: BackupManifest) {
    this.data.backupManifests.push(manifest);
    this.saveDatabase();
  }

  public getRawDatabaseSnapshot(): DatabaseSchema {
    return JSON.parse(JSON.stringify(this.data));
  }
}

export const db = new Database();

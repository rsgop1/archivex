import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StorageStats, FileCategory } from '../src/types/index.ts';
import { db } from './db.ts';

const ARCHIVE_ROOT = path.resolve(process.cwd(), 'archive');

export const SUBDIRS: Record<string, string> = {
  videos: path.join(ARCHIVE_ROOT, 'videos'),
  documents: path.join(ARCHIVE_ROOT, 'documents'),
  images: path.join(ARCHIVE_ROOT, 'images'),
  audio: path.join(ARCHIVE_ROOT, 'audio'),
  other: path.join(ARCHIVE_ROOT, 'other'),
  temporary: path.join(ARCHIVE_ROOT, 'temporary'),
  quarantine: path.join(ARCHIVE_ROOT, 'quarantine'),
  manifests: path.join(ARCHIVE_ROOT, 'manifests'),
  logs: path.join(ARCHIVE_ROOT, 'logs'),
  backups: path.join(ARCHIVE_ROOT, 'backups'),
};

export class StorageEngine {
  constructor() {
    this.ensureDirectories();
  }

  public ensureDirectories() {
    for (const dir of Object.values(SUBDIRS)) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  public getRootPath(): string {
    return ARCHIVE_ROOT;
  }

  public getCategoryDir(category: FileCategory): string {
    return SUBDIRS[category] || SUBDIRS.other;
  }

  public getRelativeCategoryPath(category: FileCategory, filename: string): string {
    return path.join(category, filename);
  }

  public getAbsolutePath(relativePath: string): string {
    // Prevent path traversal
    const resolved = path.resolve(ARCHIVE_ROOT, relativePath);
    if (!resolved.startsWith(ARCHIVE_ROOT)) {
      throw new Error('Access denied: Path traversal attempt detected.');
    }
    return resolved;
  }

  public computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  public getStorageStats(): StorageStats {
    let totalBytes = 500 * 1024 * 1024 * 1024; // 500 GB nominal disk size
    let freeBytes = 380 * 1024 * 1024 * 1024; // ~380 GB free
    let usedBytes = totalBytes - freeBytes;

    try {
      // Use Node.js native statfsSync if supported
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(ARCHIVE_ROOT);
        totalBytes = stats.bsize * stats.blocks;
        freeBytes = stats.bsize * stats.bavail;
        usedBytes = totalBytes - freeBytes;
      }
    } catch {
      // Fallback if statfs fails in virtual environment
    }

    const settings = db.getSettings();
    const reserveThresholdBytes = settings.diskReserveGb * 1024 * 1024 * 1024;
    const isReserveCritical = freeBytes < reserveThresholdBytes;

    // Calculate actual category breakdown from database files
    const allFiles = db.getFiles({ pageSize: 1000 }).files;
    const breakdown = {
      videos: { count: 0, bytes: 0 },
      documents: { count: 0, bytes: 0 },
      images: { count: 0, bytes: 0 },
      audio: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 },
    };

    for (const f of allFiles) {
      const cat = f.category in breakdown ? f.category : 'other';
      breakdown[cat].count++;
      breakdown[cat].bytes += f.size_bytes;
    }

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      reserveThresholdBytes,
      isReserveCritical,
      rootPath: ARCHIVE_ROOT,
      categoryBreakdown: breakdown,
    };
  }

  public moveToQuarantine(filePath: string, reason: string): string {
    const filename = path.basename(filePath);
    const quarantineTarget = path.join(SUBDIRS.quarantine, `${Date.now()}_${filename}`);
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, quarantineTarget);
    }
    const reasonFile = `${quarantineTarget}.reason.txt`;
    fs.writeFileSync(reasonFile, `Quarantined on ${new Date().toISOString()}: ${reason}`);
    return quarantineTarget;
  }
}

export const storage = new StorageEngine();

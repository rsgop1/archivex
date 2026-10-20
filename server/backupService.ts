import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from './db.ts';
import { storage, SUBDIRS } from './storage.ts';
import { BackupManifest } from '../src/types/index.ts';

export class BackupService {
  public async createBackup(): Promise<BackupManifest> {
    storage.ensureDirectories();

    const snapshot = db.getRawDatabaseSnapshot();
    const manifestId = `manifest-${Date.now()}`;
    const manifestFile = path.join(SUBDIRS.manifests, `${manifestId}.json`);

    // Verify physical files and calculate checksums
    const allFiles = Object.values(snapshot.files);
    let missingCount = 0;
    let totalBytes = 0;

    for (const f of allFiles) {
      totalBytes += f.size_bytes;
      try {
        const absPath = storage.getAbsolutePath(f.storage_path);
        if (!fs.existsSync(absPath)) {
          missingCount++;
        }
      } catch {
        missingCount++;
      }
    }

    const snapshotRaw = JSON.stringify(snapshot, null, 2);
    const dbChecksum = crypto.createHash('sha256').update(snapshotRaw).digest('hex');

    const manifestData: BackupManifest = {
      id: manifestId,
      created_at: new Date().toISOString(),
      manifest_path: path.relative(storage.getRootPath(), manifestFile),
      total_files_indexed: allFiles.length,
      total_bytes: totalBytes,
      db_snapshot_checksum: dbChecksum,
      verified: missingCount === 0,
      orphaned_files_detected: 0,
      missing_files_detected: missingCount,
    };

    fs.writeFileSync(manifestFile, JSON.stringify(manifestData, null, 2), 'utf-8');
    db.addBackupManifest(manifestData);

    db.addAuditLog({
      action: 'BACKUP_MANIFEST_CREATED',
      entityType: 'BACKUP_SYSTEM',
      entityId: manifestId,
      user: 'admin',
      details: {
        totalFiles: allFiles.length,
        totalBytes,
        missingFiles: missingCount,
        verified: manifestData.verified,
      },
      level: missingCount > 0 ? 'WARN' : 'INFO',
    });

    return manifestData;
  }

  public getManifests(): BackupManifest[] {
    return db.getBackupManifests();
  }
}

export const backupService = new BackupService();

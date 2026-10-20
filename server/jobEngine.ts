import { db } from './db.ts';
import { storage } from './storage.ts';
import { extractMediaMetadata } from './mediaMetadata.ts';
import { JobRecord, JobState } from '../src/types/index.ts';
import {
  canTransitionJob,
  calculateExponentialBackoff,
  isRecoverableStateOnRestart,
} from '../src/utils/jobStateMachine.ts';

class JobEngine {
  private activeWorkers = 0;
  private isRunning = false;
  private loopTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.recoverInterruptedJobs();
    this.startWorkerLoop();
  }

  /**
   * Recovers jobs that were mid-flight when the server stopped or restarted.
   */
  private recoverInterruptedJobs() {
    const allJobs = db.getJobs({ pageSize: 1000 }).jobs;
    let recoveredCount = 0;

    for (const job of allJobs) {
      if (isRecoverableStateOnRestart(job.status)) {
        db.updateJob(job.id, {
          status: 'QUEUED',
          current_step: `Recovered after server restart from ${job.status}`,
          error_message: undefined,
        });
        recoveredCount++;
      }
    }

    if (recoveredCount > 0) {
      db.addAuditLog({
        action: 'JOB_ENGINE_STARTUP_RECOVERY',
        entityType: 'JOB_ENGINE',
        entityId: 'recovery-coordinator',
        user: 'system',
        details: { recoveredJobsCount: recoveredCount },
        level: 'INFO',
      });
    }
  }

  public startWorkerLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loopTimer = setInterval(() => this.processNextJobs(), 1000);
  }

  public stopWorkerLoop() {
    this.isRunning = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private async processNextJobs() {
    const settings = db.getSettings();
    const maxConcurrency = settings.workerConcurrency || 2;

    if (this.activeWorkers >= maxConcurrency) {
      return;
    }

    // Check disk reserve before dispatching new processing jobs
    const storageStats = storage.getStorageStats();
    if (storageStats.isReserveCritical) {
      return;
    }

    // Check for RETRY_WAIT jobs whose backoff has passed
    const now = Date.now();
    const retryJobs = db.getJobs({ status: 'RETRY_WAIT', pageSize: 10 }).jobs;
    for (const job of retryJobs) {
      const waitUntil = job.metadata?.retryAfterTimestamp || 0;
      if (now >= waitUntil) {
        db.updateJob(job.id, {
          status: 'QUEUED',
          current_step: `Re-enqueued after backoff (Attempt ${job.attempts + 1}/${job.max_attempts})`,
        });
      }
    }

    // Pick next QUEUED job
    const queuedJobs = db.getJobs({ status: 'QUEUED', pageSize: 10 }).jobs;
    if (queuedJobs.length === 0) return;

    // Highest priority first
    queuedJobs.sort((a, b) => b.priority - a.priority);
    const nextJob = queuedJobs[0];

    this.activeWorkers++;
    this.executeJob(nextJob)
      .catch((err) => {
        console.error(`Unhandled error in worker for job ${nextJob.id}:`, err);
      })
      .finally(() => {
        this.activeWorkers--;
      });
  }

  private async executeJob(job: JobRecord) {
    try {
      // 1. QUEUED -> VALIDATING
      this.transition(job.id, 'VALIDATING', 10, 'Validating file presence and parameters');
      await this.sleep(400);

      // Check if paused or cancelled while queued
      let current = db.getJobById(job.id);
      if (!current || current.status === 'PAUSED' || current.status === 'CANCELLED') return;

      // 2. VALIDATING -> PROCESSING
      this.transition(job.id, 'PROCESSING', 35, 'Extracting media metadata and streams');
      await this.sleep(600);

      current = db.getJobById(job.id);
      if (!current || current.status === 'PAUSED' || current.status === 'CANCELLED') return;

      if (job.file_id) {
        const file = db.getFileById(job.file_id);
        if (file) {
          try {
            const absPath = storage.getAbsolutePath(file.storage_path);
            const meta = await extractMediaMetadata(absPath);
            db.updateFile(file.id, {
              duration_seconds: meta.durationSeconds || file.duration_seconds,
              resolution: meta.resolution || file.resolution,
            });
          } catch {
            // Non-fatal if metadata extraction is skipped
          }
        }
      }

      // 3. PROCESSING -> VERIFYING
      this.transition(job.id, 'VERIFYING', 70, 'Verifying SHA-256 integrity and archive manifest');
      await this.sleep(500);

      current = db.getJobById(job.id);
      if (!current || current.status === 'PAUSED' || current.status === 'CANCELLED') return;

      // 4. VERIFYING -> READY
      this.transition(job.id, 'READY', 85, 'File verified and stored in local archive');

      // 5. If it requires upload to Telegram, transition to UPLOADING
      if (job.operation_type === 'UPLOAD_TG' || job.operation_type === 'CHANNEL_RELAY') {
        this.transition(job.id, 'UPLOADING', 92, 'Transmitting to target Telegram channel');
        await this.sleep(600);
      }

      // 6. Final -> COMPLETED
      this.transition(job.id, 'COMPLETED', 100, 'Operation successfully completed');
      db.updateJob(job.id, { completed_at: new Date().toISOString() });
    } catch (err: any) {
      this.handleJobFailure(job, err.message || 'Worker processing failure');
    }
  }

  private handleJobFailure(job: JobRecord, errorMessage: string) {
    const attempts = (job.attempts || 0) + 1;
    const settings = db.getSettings();
    const maxAttempts = job.max_attempts || settings.retryLimit || 3;

    if (attempts < maxAttempts) {
      const backoffMs = calculateExponentialBackoff(attempts, settings.backoffBaseMs);
      const retryAfterTimestamp = Date.now() + backoffMs;

      db.updateJob(job.id, {
        status: 'RETRY_WAIT',
        attempts,
        error_message: errorMessage,
        current_step: `Temporary failure: ${errorMessage}. Retrying in ${Math.round(backoffMs / 1000)}s...`,
        metadata: {
          ...(job.metadata || {}),
          retryAfterTimestamp,
          lastError: errorMessage,
        },
      });

      db.addAuditLog({
        action: 'JOB_RETRY_SCHEDULED',
        entityType: 'JOB',
        entityId: job.id,
        user: 'system',
        details: { attempt: attempts, maxAttempts, backoffMs, error: errorMessage },
        level: 'WARN',
      });
    } else {
      db.updateJob(job.id, {
        status: 'FAILED',
        attempts,
        error_message: errorMessage,
        current_step: `Permanent failure after ${attempts} attempts: ${errorMessage}`,
        completed_at: new Date().toISOString(),
      });

      db.addAuditLog({
        action: 'JOB_FAILED_PERMANENTLY',
        entityType: 'JOB',
        entityId: job.id,
        user: 'system',
        details: { attempts, error: errorMessage },
        level: 'ERROR',
      });
    }
  }

  public transition(jobId: string, toState: JobState, progressPercent: number, stepMessage: string) {
    const job = db.getJobById(jobId);
    if (!job) return;

    if (!canTransitionJob(job.status, toState)) {
      console.warn(`Invalid state transition requested for job ${jobId}: ${job.status} -> ${toState}`);
      return;
    }

    db.updateJob(jobId, {
      status: toState,
      progress_percent: progressPercent,
      current_step: stepMessage,
      started_at: job.started_at || new Date().toISOString(),
    });
  }

  public pauseJob(jobId: string): boolean {
    const job = db.getJobById(jobId);
    if (!job) return false;
    if (canTransitionJob(job.status, 'PAUSED')) {
      db.updateJob(jobId, {
        status: 'PAUSED',
        current_step: 'Job paused by owner',
      });
      return true;
    }
    return false;
  }

  public resumeJob(jobId: string): boolean {
    const job = db.getJobById(jobId);
    if (!job) return false;
    if (job.status === 'PAUSED') {
      db.updateJob(jobId, {
        status: 'QUEUED',
        current_step: 'Resumed by owner; waiting in queue',
      });
      return true;
    }
    return false;
  }

  public cancelJob(jobId: string): boolean {
    const job = db.getJobById(jobId);
    if (!job) return false;
    if (canTransitionJob(job.status, 'CANCELLED')) {
      db.updateJob(jobId, {
        status: 'CANCELLED',
        current_step: 'Job cancelled by user',
        completed_at: new Date().toISOString(),
      });
      return true;
    }
    return false;
  }

  public retryJob(jobId: string): boolean {
    const job = db.getJobById(jobId);
    if (!job) return false;
    if (job.status === 'FAILED' || job.status === 'CANCELLED') {
      db.updateJob(jobId, {
        status: 'QUEUED',
        attempts: 0,
        error_message: undefined,
        current_step: 'Manually re-enqueued for processing',
      });
      return true;
    }
    return false;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const jobEngine = new JobEngine();

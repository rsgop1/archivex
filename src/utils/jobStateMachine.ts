/**
 * ARCHIVEX Job Engine State Machine
 * Formally defines valid transitions between the 11 states:
 * QUEUED, VALIDATING, PROCESSING, VERIFYING, READY, UPLOADING, COMPLETED, RETRY_WAIT, PAUSED, FAILED, CANCELLED
 */

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

const VALID_TRANSITIONS: Record<JobState, JobState[]> = {
  QUEUED: ['VALIDATING', 'PROCESSING', 'PAUSED', 'CANCELLED'],
  VALIDATING: ['PROCESSING', 'FAILED', 'RETRY_WAIT', 'PAUSED', 'CANCELLED'],
  PROCESSING: ['VERIFYING', 'READY', 'FAILED', 'RETRY_WAIT', 'PAUSED', 'CANCELLED'],
  VERIFYING: ['READY', 'COMPLETED', 'FAILED', 'RETRY_WAIT', 'PAUSED', 'CANCELLED'],
  READY: ['UPLOADING', 'COMPLETED', 'PAUSED', 'CANCELLED'],
  UPLOADING: ['COMPLETED', 'FAILED', 'RETRY_WAIT', 'PAUSED', 'CANCELLED'],
  RETRY_WAIT: ['QUEUED', 'PAUSED', 'CANCELLED', 'FAILED'],
  PAUSED: ['QUEUED', 'PROCESSING', 'VALIDATING', 'UPLOADING', 'CANCELLED'],
  COMPLETED: [], // Terminal
  FAILED: ['QUEUED'], // Can be manually retried
  CANCELLED: ['QUEUED'], // Can be manually re-enqueued
};

export function canTransitionJob(fromState: JobState, toState: JobState): boolean {
  if (fromState === toState) return true;
  const allowed = VALID_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

export function isTerminalState(state: JobState): boolean {
  return state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED';
}

export function isRecoverableStateOnRestart(state: JobState): boolean {
  // If server restarts while jobs were mid-flight, these must be recovered
  return state === 'VALIDATING' || state === 'PROCESSING' || state === 'VERIFYING' || state === 'UPLOADING';
}

export function calculateExponentialBackoff(attempt: number, baseDelayMs: number = 2000, maxDelayMs: number = 60000): number {
  if (attempt <= 0) return 0;
  const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
  // Add small jitter (up to 15%)
  const jitter = Math.floor(Math.random() * 0.15 * backoff);
  return backoff + jitter;
}

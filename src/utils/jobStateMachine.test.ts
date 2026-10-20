import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionJob, isTerminalState, isRecoverableStateOnRestart, calculateExponentialBackoff } from './jobStateMachine.ts';

test('valid transitions in Job state machine', () => {
  assert.equal(canTransitionJob('QUEUED', 'VALIDATING'), true);
  assert.equal(canTransitionJob('VALIDATING', 'PROCESSING'), true);
  assert.equal(canTransitionJob('PROCESSING', 'VERIFYING'), true);
  assert.equal(canTransitionJob('VERIFYING', 'READY'), true);
  assert.equal(canTransitionJob('READY', 'UPLOADING'), true);
  assert.equal(canTransitionJob('UPLOADING', 'COMPLETED'), true);
  assert.equal(canTransitionJob('PROCESSING', 'FAILED'), true);
  assert.equal(canTransitionJob('FAILED', 'QUEUED'), true); // Retry allowed
});

test('invalid transitions are rejected', () => {
  assert.equal(canTransitionJob('COMPLETED', 'PROCESSING'), false);
  assert.equal(canTransitionJob('QUEUED', 'COMPLETED'), false);
  assert.equal(canTransitionJob('FAILED', 'COMPLETED'), false);
});

test('isTerminalState detects terminal states', () => {
  assert.equal(isTerminalState('COMPLETED'), true);
  assert.equal(isTerminalState('FAILED'), true);
  assert.equal(isTerminalState('CANCELLED'), true);
  assert.equal(isTerminalState('PROCESSING'), false);
  assert.equal(isTerminalState('QUEUED'), false);
});

test('isRecoverableStateOnRestart flags mid-flight jobs', () => {
  assert.equal(isRecoverableStateOnRestart('PROCESSING'), true);
  assert.equal(isRecoverableStateOnRestart('UPLOADING'), true);
  assert.equal(isRecoverableStateOnRestart('COMPLETED'), false);
  assert.equal(isRecoverableStateOnRestart('QUEUED'), false);
});

test('calculateExponentialBackoff scales with attempt', () => {
  const b1 = calculateExponentialBackoff(1, 1000);
  const b2 = calculateExponentialBackoff(2, 1000);
  const b3 = calculateExponentialBackoff(3, 1000);
  assert.ok(b1 >= 1000 && b1 <= 1200);
  assert.ok(b2 >= 2000 && b2 <= 2400);
  assert.ok(b3 >= 4000 && b3 <= 4800);
});

import assert from 'node:assert/strict';
import {
  canChangeGuestStatus,
  canReopenSocialEvent,
  getAutomaticClosure,
  getPublicGuestNames,
} from '../lib/domain/social-event.js';

assert.equal(canChangeGuestStatus('OPEN', 'CONFIRMED'), true);
assert.equal(canChangeGuestStatus('CLOSED', 'CONFIRMED'), false);
assert.equal(canChangeGuestStatus('CANCELLED', 'PENDING'), false);
assert.equal(canReopenSocialEvent('CLOSED', 'MANUAL'), true);
assert.equal(canReopenSocialEvent('CLOSED', 'AUTOMATIC'), false);
assert.equal(canReopenSocialEvent('CANCELLED', 'MANUAL'), false);

const start = new Date('2026-11-15T15:00:00.000Z');
assert.equal(getAutomaticClosure('OPEN', start, new Date('2026-11-15T14:59:59.999Z')), false);
assert.equal(getAutomaticClosure('OPEN', start, start), true);
assert.equal(getAutomaticClosure('CLOSED', start, start), false);
assert.equal(getAutomaticClosure('OPEN', 'invalid-date', start), false);

assert.deepEqual(getPublicGuestNames([
  { name: 'Ana', status: 'CONFIRMED' },
  { name: 'Beto', status: 'PENDING' },
  { name: 'Caio', status: 'CANCELLED' },
]), ['Ana']);
console.log('Social event domain tests passed');

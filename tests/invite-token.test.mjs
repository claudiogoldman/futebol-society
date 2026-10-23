import assert from 'node:assert/strict';
import { encodeInviteToken, decodeInviteToken } from '../lib/domain/invite-token.js';

const samples = [
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'c1874176-9361-49a5-9810-082e3930b5cd',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
];

for (const uuid of samples) {
  const encoded = encodeInviteToken(uuid);
  assert.match(encoded, /^[0-9A-Za-z]{1,22}$/);
  assert.equal(decodeInviteToken(encoded), uuid);
  assert.equal(decodeInviteToken(uuid), uuid);
}

const compact = encodeInviteToken(samples[2]);
assert.equal(compact.length, 22);
assert.equal(decodeInviteToken('not-a-token'), 'not-a-token');
console.log('Invite token encoding tests passed');

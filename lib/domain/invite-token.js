const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BigInt(ALPHABET.length);
const UUID_HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE62_TOKEN = /^[0-9A-Za-z]{1,22}$/;

export function encodeInviteToken(uuid) {
  if (typeof uuid !== 'string' || !UUID_HEX.test(uuid)) {
    throw new TypeError('Invite token must be a UUID');
  }

  let value = BigInt('0x' + uuid.replace(/-/g, ''));
  if (value === 0n) return '0';

  let encoded = '';
  while (value > 0n) {
    encoded = ALPHABET[Number(value % BASE)] + encoded;
    value /= BASE;
  }
  return encoded;
}

export function decodeInviteToken(token) {
  if (typeof token !== 'string' || token.length === 0) return token;
  if (UUID_HEX.test(token)) return token;
  if (!BASE62_TOKEN.test(token)) return token;

  let value = 0n;
  for (const char of token) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) return token;
    value = value * BASE + BigInt(digit);
  }

  if (value >= (1n << 128n)) return token;
  const hex = value.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizeInviteToken(token) {
  return decodeInviteToken(token);
}

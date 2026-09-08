// Pix helpers: BR Code / EMV payload generation and key classification.
// Kept in the domain layer so UI components only consume Pix behavior.

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

// Strip accents / non-ASCII and clamp length — required by the BR Code spec.
function pixSanitize(str, maxLen) {
  const clean = (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim();
  return (clean || 'NA').slice(0, maxLen);
}

function generatePixCode({ key, receiverName, city, amount, txid }) {
  if (!key) return null;
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', key.trim());
  const additionalData = tlv('05', pixSanitize(txid || '***', 25));
  let payload =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (amount > 0 ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', pixSanitize(receiverName, 25)) +
    tlv('60', pixSanitize(city || 'BRASIL', 15)) +
    tlv('62', additionalData);
  payload += '6304';
  return payload + crc16(payload);
}

// Identifies which kind of Pix key was entered, just to label it clearly in the UI.
function pixKeyType(key) {
  if (!key) return null;
  const k = key.trim();
  if (/^\+55\d{10,11}$/.test(k)) return 'Telefone';
  if (/^\d{11}$/.test(k)) return 'CPF';
  if (/^\d{14}$/.test(k)) return 'CNPJ';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return 'E-mail';
  if (/^[0-9a-fA-F-]{32,36}$/.test(k)) return 'Chave aleatória';
  return 'Chave Pix';
}

// A bare 11-digit number is ambiguous between CPF and a Brazilian phone
// (both have 11 digits) — phone keys are only valid with the +55 country code,
// so warn instead of guessing wrong.
function pixKeyWarning(key) {
  if (!key) return null;
  const k = key.trim();
  if (/^\d{10,11}$/.test(k)) {
    return 'Se isso for um telefone, precisa começar com +55 (ex: +5551999998888) — só números o Pix não reconhece como telefone.';
  }
  return null;
}

export { generatePixCode, pixKeyType, pixKeyWarning };

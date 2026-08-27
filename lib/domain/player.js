export const POSITION_LABELS = {
  goleiro: 'Goleiro',
  fixo: 'Fixo',
  libero: 'Líbero',
  meio: 'Meio',
  ala_esquerdo: 'Ala Esquerdo',
  ala_direito: 'Ala Direito',
  pivo: 'Pivô',
};

export const POSITION_ORDER = [
  'goleiro',
  'fixo',
  'libero',
  'meio',
  'ala_esquerdo',
  'ala_direito',
  'pivo',
];

export const POSITION_ABBREV = {
  goleiro: 'GOL',
  fixo: 'FIX',
  libero: 'LIB',
  meio: 'MEI',
  ala_esquerdo: 'ALE',
  ala_direito: 'ALD',
  pivo: 'PIV',
};

export function computeOVR(player = {}) {
  const values = [
    player.attr_ata,
    player.attr_def,
    player.attr_for,
    player.attr_hab,
  ].map((value) => (value == null ? 50 : value));

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function primaryPositionAbbrev(player = {}) {
  const knownPosition = Array.isArray(player.positions)
    ? player.positions.find((position) => POSITION_ABBREV[position])
    : null;

  return knownPosition ? POSITION_ABBREV[knownPosition] : 'LIN';
}

export function playerMeta(player = {}) {
  const bits = [];
  const knownPositions = Array.isArray(player.positions)
    ? player.positions.filter((position) => POSITION_LABELS[position])
    : [];

  if (knownPositions.length > 0) {
    bits.push(knownPositions.map((position) => POSITION_LABELS[position]).join(' / '));
  }
  if (player.age) bits.push(`${player.age} anos`);
  if (player.weight_kg) bits.push(`${player.weight_kg}kg`);

  return bits.join(' · ');
}

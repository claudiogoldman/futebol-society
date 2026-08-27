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

export function cardTier(ovr) {
  if (ovr >= 80) {
    return {
      grad: 'linear-gradient(160deg, #0B2417 0%, #1E4A2E 45%, #FFC53D 100%)',
      label: 'Lenda',
      text: '#EDF6EE',
      accent: '#FFC53D',
    };
  }

  if (ovr >= 65) {
    return {
      grad: 'linear-gradient(160deg, #8A6412 0%, #FFC53D 55%, #FFE9B0 100%)',
      label: 'Ouro',
      text: '#0B2417',
      accent: '#0B2417',
    };
  }

  if (ovr >= 50) {
    return {
      grad: 'linear-gradient(160deg, #5A636B 0%, #C7CDD3 55%, #EEF1F3 100%)',
      label: 'Prata',
      text: '#0B2417',
      accent: '#0B2417',
    };
  }

  return {
    grad: 'linear-gradient(160deg, #4A2E18 0%, #8B5E3C 55%, #C89B6E 100%)',
    label: 'Bronze',
    text: '#EDF6EE',
    accent: '#EDF6EE',
  };
}

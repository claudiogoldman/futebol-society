export const COUNTRIES = [
  ['BR', 'Brasil'], ['AR', 'Argentina'], ['UY', 'Uruguai'], ['PY', 'Paraguai'], ['CL', 'Chile'],
  ['BO', 'Bolívia'], ['PE', 'Peru'], ['CO', 'Colômbia'], ['EC', 'Equador'], ['VE', 'Venezuela'],
  ['MX', 'México'], ['US', 'Estados Unidos'], ['CA', 'Canadá'], ['PT', 'Portugal'], ['ES', 'Espanha'],
  ['FR', 'França'], ['DE', 'Alemanha'], ['IT', 'Itália'], ['GB', 'Reino Unido'], ['NL', 'Países Baixos'],
  ['BE', 'Bélgica'], ['CH', 'Suíça'], ['SE', 'Suécia'], ['NO', 'Noruega'], ['DK', 'Dinamarca'],
  ['FI', 'Finlândia'], ['IE', 'Irlanda'], ['PL', 'Polônia'], ['UA', 'Ucrânia'], ['RU', 'Rússia'],
  ['TR', 'Turquia'], ['JP', 'Japão'], ['KR', 'Coreia do Sul'], ['CN', 'China'], ['IN', 'Índia'],
  ['AU', 'Austrália'], ['NZ', 'Nova Zelândia'], ['ZA', 'África do Sul'], ['NG', 'Nigéria'], ['MA', 'Marrocos'],
];

export const NATIONALITIES = COUNTRIES;

export function normalizeNationalityCode(value) {
  const raw = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : null;
}

export function countryFlag(value) {
  const code = normalizeNationalityCode(value);
  if (!code) return null;
  return String.fromCodePoint(...[...code].map((char) => 0x1F1E6 + char.charCodeAt(0) - 65));
}

export function countryName(value) {
  const code = normalizeNationalityCode(value);
  if (!code) return null;
  return COUNTRIES.find(([countryCode]) => countryCode === code)?.[1] || code;
}

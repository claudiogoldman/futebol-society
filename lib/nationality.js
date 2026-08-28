export const NATIONALITIES = [
  ['BR', 'Brasil'], ['AR', 'Argentina'], ['UY', 'Uruguai'], ['PY', 'Paraguai'], ['CL', 'Chile'],
  ['CO', 'Colômbia'], ['PE', 'Peru'], ['BO', 'Bolívia'], ['EC', 'Equador'], ['VE', 'Venezuela'],
  ['PT', 'Portugal'], ['ES', 'Espanha'], ['FR', 'França'], ['DE', 'Alemanha'], ['IT', 'Itália'], ['GB', 'Reino Unido'],
  ['US', 'Estados Unidos'], ['MX', 'México'], ['JP', 'Japão'], ['KR', 'Coreia do Sul']
].map(([code, name]) => ({ code, name }));

export function flagForNationality(code) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

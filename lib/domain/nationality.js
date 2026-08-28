export const NATIONALITIES = [
  ['BR', '🇧🇷', 'Brasil'], ['AR', '🇦🇷', 'Argentina'], ['UY', '🇺🇾', 'Uruguai'],
  ['PY', '🇵🇾', 'Paraguai'], ['CL', '🇨🇱', 'Chile'], ['CO', '🇨🇴', 'Colômbia'],
  ['PT', '🇵🇹', 'Portugal'], ['ES', '🇪🇸', 'Espanha'], ['IT', '🇮🇹', 'Itália'],
  ['FR', '🇫🇷', 'França'], ['DE', '🇩🇪', 'Alemanha'], ['GB', '🇬🇧', 'Reino Unido'],
  ['US', '🇺🇸', 'Estados Unidos'], ['MX', '🇲🇽', 'México'], ['JP', '🇯🇵', 'Japão'],
];

export function nationalityInfo(code) {
  const normalized = String(code || '').toUpperCase();
  const found = NATIONALITIES.find(([value]) => value === normalized);
  return found ? { code: found[0], flag: found[1], name: found[2] } : null;
}

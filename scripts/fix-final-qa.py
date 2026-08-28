from pathlib import Path

p = Path('app/page.js')
s = p.read_text()

# Guarantee the nationality catalogue and a single conversion helper.
if 'const NATIONALITIES =' not in s:
    anchor = "const POSITION_ORDER = ['goleiro', 'fixo', 'libero', 'meio', 'ala_esquerdo', 'ala_direito', 'pivo'];"
    insert = anchor + "\nconst NATIONALITIES = [{ code: 'BR', name: 'Brasil', flag: '🇧🇷' }, { code: 'AR', name: 'Argentina', flag: '🇦🇷' }, { code: 'UY', name: 'Uruguai', flag: '🇺🇾' }, { code: 'PT', name: 'Portugal', flag: '🇵🇹' }, { code: 'ES', name: 'Espanha', flag: '🇪🇸' }, { code: 'IT', name: 'Itália', flag: '🇮🇹' }, { code: 'DE', name: 'Alemanha', flag: '🇩🇪' }, { code: 'FR', name: 'França', flag: '🇫🇷' }, { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' }, { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' }, { code: 'MX', name: 'México', flag: '🇲🇽' }, { code: 'CL', name: 'Chile', flag: '🇨🇱' }, { code: 'CO', name: 'Colômbia', flag: '🇨🇴' }, { code: 'PY', name: 'Paraguai', flag: '🇵🇾' }, { code: 'OTHER', name: 'Outra', flag: '🌐' }];\nconst nationalityFlag = (code) => NATIONALITIES.find((n) => n.code === code)?.flag || '🌐';"
    if anchor in s:
        s = s.replace(anchor, insert, 1)

# Some previous UI versions rendered the ISO code (BR) instead of the flag.
s = s.replace('{n.code} {n.name}', '{n.flag} {n.name}')
s = s.replace('{n.code} — {n.name}', '{n.flag} {n.name}')
s = s.replace('${n.code} ${n.name}', '${n.flag} ${n.name}')

# Ensure the player card carries nationality even when another patch inserted the card first.
if 'const flag = nationalityFlag(player.nationality_code);' not in s:
    old = "  const firstName = (player.name || '?').trim().split(' ')[0];"
    if old in s:
        s = s.replace(old, old + "\n  const flag = nationalityFlag(player.nationality_code);", 1)
s = s.replace('<div className="sf-pcard-name">{firstName}</div>', '<div className="sf-pcard-name">{flag} {firstName}</div>')

# Guarantee a visible flag in the profile nationality field. This also handles older versions
# that displayed the stored ISO code as the option label.
s = s.replace('<option value="BR">BR Brasil</option>', '<option value="BR">🇧🇷 Brasil</option>')

# Guard against source corruption in WhatsApp message literals.
s = s.replace('! � Só lembrando:', '! \\u26BD Só lembrando:')
s = s.replace('Valeu! �', 'Valeu! \\u{1F64F}')

p.write_text(s)
print('final QA patch applied')

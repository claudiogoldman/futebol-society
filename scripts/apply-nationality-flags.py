from pathlib import Path

p = Path('app/page.js')
s = p.read_text()

s = s.replace(
    "import { supabase } from '../lib/supabaseClient';",
    "import { supabase } from '../lib/supabaseClient';\nimport { NATIONALITIES, countryFlag } from '../lib/countries';",
    1,
)

s = s.replace(
    '<div className="sf-pcard-name">{firstName}</div>',
    '<div className="sf-pcard-name">{player.nationality_code ? <span aria-label={player.nationality_code} style={{ marginRight: 3 }}>{countryFlag(player.nationality_code)}</span> : null}{firstName}</div>',
    1,
)

marker = '<div className="sf-h3">{me.name} <span className="sf-me-tag">você</span></div>'
replacement = '''<div className="sf-h3">{me.name} <span className="sf-me-tag">você</span></div>
      <div className="sf-muted-sm" style={{ margin: '12px 0 6px' }}>Nacionalidade</div>
      <select
        className="sf-input"
        value={me.nationality_code || ''}
        onChange={(e) => onUpdate({ nationality_code: e.target.value || null })}
      >
        <option value="">Sem nacionalidade</option>
        {NATIONALITIES.map(([code, name]) => <option key={code} value={code}>{countryFlag(code)} {name}</option>)}
      </select>'''
if marker not in s:
    raise SystemExit('profile nationality marker not found')
s = s.replace(marker, replacement, 1)

marker = '''                        {p.name}
                        {p.is_admin && <span className="sf-admin-tag" title="Admin">ADMIN</span>}'''
replacement = '''                        {p.nationality_code ? <span aria-label={p.nationality_code} style={{ marginRight: 5 }}>{countryFlag(p.nationality_code)}</span> : null}
                        {p.name}
                        {p.is_admin && <span className="sf-admin-tag" title="Admin">ADMIN</span>}'''
if marker not in s:
    raise SystemExit('roster nationality marker not found')
s = s.replace(marker, replacement, 1)

marker = '''                      {i === 0 && r.pontos > 0 ? '🏆 ' : ''}{r.name}{r.mvps > 0 ? <span className="sf-mvp-tag"> ⭐×{r.mvps}</span> : ''}'''
replacement = '''                      {i === 0 && r.pontos > 0 ? '🏆 ' : ''}{r.nationality_code ? <span aria-label={r.nationality_code} style={{ marginRight: 5 }}>{countryFlag(r.nationality_code)}</span> : null}{r.name}{r.mvps > 0 ? <span className="sf-mvp-tag"> ⭐×{r.mvps}</span> : ''}'''
if marker not in s:
    raise SystemExit('ranking nationality marker not found')
s = s.replace(marker, replacement, 1)

marker = "profiles.forEach((p) => { stats[p.id] = { id: p.id, name: p.name, jogos: 0,"
replacement = "profiles.forEach((p) => { stats[p.id] = { id: p.id, name: p.name, nationality_code: p.nationality_code || null, jogos: 0,"
if marker not in s:
    raise SystemExit('ranking stats marker not found')
s = s.replace(marker, replacement, 1)

p.write_text(s)
print('nationality flags patch applied')

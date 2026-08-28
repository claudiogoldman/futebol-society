from pathlib import Path

# Keep the Elenco view scoped to groups the current player belongs to.
path = Path('app/page.js')
text = path.read_text(encoding='utf-8')

old = "const [selectedGroupId, setSelectedGroupId] = useState(null);"
new = old + "\n  const [elencoGroupFilter, setElencoGroupFilter] = useState('all');"
if old not in text:
    raise SystemExit('state anchor not found')
text = text.replace(old, new, 1)

old = "  const selectedGroup = groups.find((g) => g.id === selectedGroupId);\n\n  if (loading) {"
new = """  const selectedGroup = groups.find((g) => g.id === selectedGroupId);\n  const myGroupIds = useMemo(() => {\n    const ids = new Set(groupMembers.filter((m) => m.user_id === myId).map((m) => m.group_id));\n    groups.filter((g) => g.createdBy === myId).forEach((g) => ids.add(g.id));\n    return ids;\n  }, [groupMembers, groups, myId]);\n  const elencoGroupOptions = useMemo(\n    () => groups.filter((g) => myGroupIds.has(g.id)).sort((a, b) => a.name.localeCompare(b.name)),\n    [groups, myGroupIds]\n  );\n  const elencoProfiles = useMemo(() => {\n    const scopedGroupIds = elencoGroupFilter === 'all'\n      ? myGroupIds\n      : new Set(myGroupIds.has(elencoGroupFilter) ? [elencoGroupFilter] : []);\n    const memberIds = new Set(\n      groupMembers\n        .filter((m) => scopedGroupIds.has(m.group_id))\n        .map((m) => m.user_id)\n    );\n    return profiles.filter((p) => p.id !== myId && memberIds.has(p.id));\n  }, [profiles, groupMembers, myId, myGroupIds, elencoGroupFilter]);\n\n  if (loading) {"""
if old not in text:
    raise SystemExit('derived-data anchor not found')
text = text.replace(old, new, 1)

old = """            {subTab === 'elenco' && (\n              <>\n                {me && <MyProfileCard me={me} onUpdate={updateMyProfile} />}\n                {profiles.filter((p) => p.id !== myId).map((p) => ("""
new = """            {subTab === 'elenco' && (\n              <>\n                <div className=\"sf-roster-filter\">\n                  <label className=\"sf-field-label\">Grupo</label>\n                  <select\n                    className=\"sf-input\"\n                    value={elencoGroupFilter}\n                    onChange={(e) => setElencoGroupFilter(e.target.value)}\n                  >\n                    <option value=\"all\">Todos os meus grupos</option>\n                    {elencoGroupOptions.map((g) => (\n                      <option key={g.id} value={g.id}>{g.name}</option>\n                    ))}\n                  </select>\n                </div>\n                {me && <MyProfileCard me={me} onUpdate={updateMyProfile} />}\n                {elencoProfiles.map((p) => ("""
if old not in text:
    raise SystemExit('elenco anchor not found')
text = text.replace(old, new, 1)

old = """                <p className=\"sf-muted-sm sf-roster-hint\">\n                  O elenco é formado por quem já entrou no app com a conta Google. Manda o link pra galera se cadastrar.\n                  {me?.is_admin ? ' Você é admin: pode editar partidas de qualquer organizador e indicar outros admins.' : ''}\n                </p>"""
new = """                <p className=\"sf-muted-sm sf-roster-hint\">\n                  O elenco mostra somente jogadores dos grupos dos quais você participa. Use o filtro acima para ver um grupo específico.\n                  {me?.is_admin ? ' Você é admin: pode editar partidas de qualquer organizador e indicar outros admins.' : ''}\n                </p>"""
if old not in text:
    raise SystemExit('hint anchor not found')
text = text.replace(old, new, 1)

old = """  .sf-list-view { display: flex; flex-direction: column; gap: 10px; }\n\n  .sf-game-card"""
new = """  .sf-list-view { display: flex; flex-direction: column; gap: 10px; }\n  .sf-roster-filter { background: var(--pitch-mid); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }\n  .sf-roster-filter .sf-field-label { display: block; margin: 0 0 6px; }\n\n  .sf-game-card"""
if old not in text:
    raise SystemExit('css anchor not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Applied roster group scope and group filter.')

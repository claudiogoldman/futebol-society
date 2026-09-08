from pathlib import Path

path = Path('app/society-page.js')
s = path.read_text(encoding='utf-8')

s = s.replace('setAdmin as serviceSetAdmin,', 'setGroupMemberRole as serviceSetGroupMemberRole,')

old = """  const toggleAdmin = async (userId, isAdmin) => {\n    const { error } = await serviceSetAdmin(userId, isAdmin);\n    if (error) { alert('Não foi possível alterar a administração: ' + error.message); return false; }\n    await loadAll();\n    return true;\n  };"""
new = """  const toggleGroupAdmin = async (groupId, userId, isAdmin) => {\n    if (!groupId) { alert('Selecione um grupo específico para alterar o administrador.'); return false; }\n    const group = groups.find((g) => String(g.id) === String(groupId));\n    if (!group || String(group.createdBy) !== String(myId)) {\n      alert('Somente o dono do grupo pode alterar os administradores.');\n      return false;\n    }\n    const { error } = await serviceSetGroupMemberRole(groupId, userId, isAdmin ? 'admin' : 'member');\n    if (error) { alert('Não foi possível alterar a administração do grupo: ' + error.message); return false; }\n    await loadAll();\n    return true;\n  };"""
if old not in s:
    raise SystemExit('toggleAdmin block not found')
s = s.replace(old, new)

old = """  const elencoProfiles = useMemo(() => {\n    const scopedGroupIds = elencoGroupFilter === 'all'\n      ? myGroupIds\n      : new Set(myGroupIds.has(elencoGroupFilter) ? [elencoGroupFilter] : []);\n    const memberIds = new Set(\n      groupMembers\n        .filter((m) => scopedGroupIds.has(m.group_id))\n        .map((m) => m.user_id)\n    );\n    return profiles.filter((p) => p.id !== myId && memberIds.has(p.id));\n  }, [profiles, groupMembers, myId, myGroupIds, elencoGroupFilter]);"""
new = old + """\n  const selectedElencoGroup = useMemo(() => (elencoGroupFilter === 'all' ? null : groups.find((g) => String(g.id) === String(elencoGroupFilter)) || null), [groups, elencoGroupFilter]);\n  const canManageSelectedGroupAdmins = !!selectedElencoGroup && String(selectedElencoGroup.createdBy) === String(myId);\n"""
if old not in s:
    raise SystemExit('elenco block not found')
s = s.replace(old, new)

old = """                        {p.is_admin && <span className=\"sf-admin-tag\" title=\"Admin\">ADMIN</span>}\n                      </div>\n                      <StarRating value={p.rating} readOnly onChange={() => {}} />\n                      {playerMeta(p) && <div className=\"sf-muted-sm\" style={{ marginTop: 3 }}>{playerMeta(p)}</div>}\n                      {me?.is_admin && (\n                        <button className=\"sf-admin-toggle\" onClick={() => toggleAdmin(p.id, !p.is_admin)}>\n                          {p.is_admin ? 'Remover admin' : 'Tornar admin'}\n                        </button>\n                      )}"""
new = """                        {(() => {\n                          const membership = elencoGroupFilter !== 'all'\n                            ? groupMembers.find((m) => String(m.group_id) === String(elencoGroupFilter) && String(m.user_id) === String(p.id))\n                            : null;\n                          return membership?.role === 'admin' ? <span className=\"sf-admin-tag\" title=\"Administrador deste grupo\">ADMIN</span> : null;\n                        })()}\n                      </div>\n                      <StarRating value={p.rating} readOnly onChange={() => {}} />\n                      {playerMeta(p) && <div className=\"sf-muted-sm\" style={{ marginTop: 3 }}>{playerMeta(p)}</div>}\n                      {canManageSelectedGroupAdmins && p.id !== selectedElencoGroup.createdBy && (\n                        <button className=\"sf-admin-toggle\" onClick={() => {\n                          const membership = groupMembers.find((m) => String(m.group_id) === String(elencoGroupFilter) && String(m.user_id) === String(p.id));\n                          toggleGroupAdmin(elencoGroupFilter, p.id, membership?.role !== 'admin');\n                        }}>\n                          {groupMembers.find((m) => String(m.group_id) === String(elencoGroupFilter) && String(m.user_id) === String(p.id))?.role === 'admin' ? 'Remover admin' : 'Tornar admin'}\n                        </button>\n                      )}"""
if old not in s:
    raise SystemExit('admin UI block not found')
s = s.replace(old, new)

old = """                  O elenco mostra somente jogadores dos grupos dos quais você participa. Use o filtro acima para ver um grupo específico.\n                  {me?.is_admin ? ' Você é admin: pode editar partidas de qualquer organizador e indicar outros admins.' : ''}"""
new = """                  O elenco mostra somente jogadores dos grupos dos quais você participa. Use o filtro acima para ver um grupo específico.\n                  {canManageSelectedGroupAdmins ? ' Você é o dono deste grupo e pode indicar ou remover administradores deste grupo.' : ''}\n                  {elencoGroupFilter === 'all' ? ' Para administrar o papel de um membro, selecione um grupo específico.' : ''}"""
if old not in s:
    raise SystemExit('roster hint block not found')
s = s.replace(old, new)

path.write_text(s, encoding='utf-8')
print('group admin scope patch applied')

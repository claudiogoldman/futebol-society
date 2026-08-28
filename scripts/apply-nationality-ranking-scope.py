from pathlib import Path

p = Path('app/page.js')
s = p.read_text()

if "const [rankingGroupFilter, setRankingGroupFilter]" not in s:
    marker = "  const [elencoGroupFilter, setElencoGroupFilter] = useState('all');"
    if marker in s:
        s = s.replace(marker, marker + "\n  const [rankingGroupFilter, setRankingGroupFilter] = useState('all');", 1)
    else:
        marker = "  const [elencoScope, setElencoScope] = useState('all');"
        if marker not in s:
            raise SystemExit('Marker not found: ranking filter state')
        s = s.replace(marker, marker + "\n  const [rankingGroupFilter, setRankingGroupFilter] = useState('all');", 1)

old = """  const scopedGroupId = elencoScope === 'all' ? null : elencoScope;
  const scopedProfileIds = scopedGroupId ? new Set(groupMembers.filter((m) => m.group_id === scopedGroupId).map((m) => m.user_id)) : null;
  const scopedProfiles = scopedProfileIds ? profiles.filter((p) => scopedProfileIds.has(p.id)) : profiles;
  const scopedGames = scopedGroupId ? games.filter((g) => g.groupId === scopedGroupId) : games;
  const ranking = useMemo(() => computeRanking(scopedProfiles, scopedGames), [scopedProfiles, scopedGames]);"""
new = """  const rankingMyGroupIds = useMemo(() => {
    const ids = new Set(groupMembers.filter((m) => m.user_id === myId).map((m) => m.group_id));
    groups.filter((g) => g.createdBy === myId).forEach((g) => ids.add(g.id));
    return ids;
  }, [groupMembers, groups, myId]);
  const rankingVisibleIds = useMemo(() => {
    const scopedGroupIds = rankingGroupFilter === 'all' ? rankingMyGroupIds : new Set(rankingMyGroupIds.has(rankingGroupFilter) ? [rankingGroupFilter] : []);
    const ids = new Set([myId]);
    groupMembers.filter((m) => scopedGroupIds.has(m.group_id)).forEach((m) => ids.add(m.user_id));
    return ids;
  }, [groupMembers, rankingMyGroupIds, myId, rankingGroupFilter]);
  const rankingScopedProfiles = useMemo(() => profiles.filter((p) => rankingVisibleIds.has(p.id)), [profiles, rankingVisibleIds]);
  const rankingScopedGames = useMemo(() => games.filter((g) => {
    if (rankingGroupFilter !== 'all' && g.groupId !== rankingGroupFilter) return false;
    const players = [...(g.teamA || []), ...(g.teamB || [])];
    return players.some((p) => rankingVisibleIds.has(p.id));
  }), [games, rankingVisibleIds, rankingGroupFilter]);
  const ranking = useMemo(() => computeRanking(rankingScopedProfiles, rankingScopedGames), [rankingScopedProfiles, rankingScopedGames]);"""
if old in s:
    s = s.replace(old, new, 1)
elif 'const rankingVisibleIds = useMemo' not in s:
    raise SystemExit('Marker not found: transformed ranking scope')

old = '''            <select className="sf-input" value={elencoScope} onChange={(e) => setElencoScope(e.target.value)} style={{ marginBottom: 12 }}>
              <option value="all">Geral — todos os grupos</option>
              {groups.map((g) => <option key={g.id} value={g.id}>Grupo — {g.name}</option>)}
            </select>
'''
new = '''            {subTab === 'ranking' && (
              <select className="sf-input" value={rankingGroupFilter} onChange={(e) => setRankingGroupFilter(e.target.value)} style={{ marginBottom: 12 }}>
                <option value="all">Geral — meus grupos</option>
                {groups.filter((g) => rankingMyGroupIds.has(g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
            {subTab === 'elenco' && (
              <select className="sf-input" value={elencoScope} onChange={(e) => setElencoScope(e.target.value)} style={{ marginBottom: 12 }}>
                <option value="all">Todos os meus grupos</option>
                {groups.filter((g) => groupMembers.some((m) => m.group_id === g.id && m.user_id === myId) || g.createdBy === myId).map((g) => <option key={g.id} value={g.id}>Grupo — {g.name}</option>)}
              </select>
            )}
'''
if old in s:
    s = s.replace(old, new, 1)
elif 'Geral — meus grupos' not in s:
    raise SystemExit('Marker not found: ranking filter UI')

p.write_text(s)
print('ranking scope patch applied')

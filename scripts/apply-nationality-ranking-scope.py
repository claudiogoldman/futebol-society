from pathlib import Path

p = Path('app/page.js')
s = p.read_text()

# Idempotent: the prebuild pipeline runs several source transforms before this one.
if "const [rankingGroupFilter, setRankingGroupFilter]" not in s:
    marker = "  const [elencoGroupFilter, setElencoGroupFilter] = useState('all');"
    if marker not in s:
        raise SystemExit('Marker not found: ranking filter state')
    s = s.replace(marker, marker + "\n  const [rankingGroupFilter, setRankingGroupFilter] = useState('all');", 1)

old = """  const ranking = useMemo(() => computeRanking(profiles, games), [profiles, games]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingGames = useMemo(() => [...games].filter((g) => g.date >= todayIso).sort((a, b) => (a.date > b.date ? 1 : -1)), [games, todayIso]);
  const pastGames = useMemo(() => [...games].filter((g) => g.date < todayIso).sort((a, b) => (a.date < b.date ? 1 : -1)), [games, todayIso]);
  const sortedGames = partidasFilter === 'passadas' ? pastGames : upcomingGames;
  const selectedGame = games.find((g) => g.id === selectedGameId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const myGroupIds = useMemo(() => {
    const ids = new Set(groupMembers.filter((m) => m.user_id === myId).map((m) => m.group_id));
    groups.filter((g) => g.createdBy === myId).forEach((g) => ids.add(g.id));
    return ids;
  }, [groupMembers, groups, myId]);
"""
new = """  const myGroupIds = useMemo(() => {
    const ids = new Set(groupMembers.filter((m) => m.user_id === myId).map((m) => m.group_id));
    groups.filter((g) => g.createdBy === myId).forEach((g) => ids.add(g.id));
    return ids;
  }, [groupMembers, groups, myId]);
  const rankingVisibleIds = useMemo(() => {
    const scopedGroupIds = rankingGroupFilter === 'all'
      ? myGroupIds
      : new Set(myGroupIds.has(rankingGroupFilter) ? [rankingGroupFilter] : []);
    const ids = new Set([myId]);
    groupMembers.filter((m) => scopedGroupIds.has(m.group_id)).forEach((m) => ids.add(m.user_id));
    return ids;
  }, [groupMembers, myGroupIds, myId, rankingGroupFilter]);
  const ranking = useMemo(() => {
    const scopedProfiles = profiles.filter((p) => rankingVisibleIds.has(p.id));
    const scopedGames = games.filter((g) => {
      if (rankingGroupFilter !== 'all' && g.groupId !== rankingGroupFilter) return false;
      const players = [...(g.teamA || []), ...(g.teamB || [])];
      return players.some((p) => rankingVisibleIds.has(p.id));
    });
    return computeRanking(scopedProfiles, scopedGames);
  }, [profiles, games, rankingVisibleIds, rankingGroupFilter]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingGames = useMemo(() => [...games].filter((g) => g.date >= todayIso).sort((a, b) => (a.date > b.date ? 1 : -1)), [games, todayIso]);
  const pastGames = useMemo(() => [...games].filter((g) => g.date < todayIso).sort((a, b) => (a.date < b.date ? 1 : -1)), [games, todayIso]);
  const sortedGames = partidasFilter === 'passadas' ? pastGames : upcomingGames;
  const selectedGame = games.find((g) => g.id === selectedGameId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
"""
if old in s:
    s = s.replace(old, new, 1)
elif 'const rankingVisibleIds = useMemo' not in s:
    raise SystemExit('Marker not found: ranking scope')

old = """            {subTab === 'ranking' && (
              <div className=\"sf-ranking-table\">
                <div className=\"sf-ranking-header\">"""
new = """            {subTab === 'ranking' && (
              <>
                <div className=\"sf-roster-filter\">
                  <label className=\"sf-field-label\">Ranking</label>
                  <select className=\"sf-input\" value={rankingGroupFilter} onChange={(e) => setRankingGroupFilter(e.target.value)}>
                    <option value=\"all\">Geral — meus grupos</option>
                    {elencoGroupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className=\"sf-ranking-table\">
                <div className=\"sf-ranking-header\">"""
if old in s:
    s = s.replace(old, new, 1)
elif 'Geral — meus grupos' not in s:
    raise SystemExit('Marker not found: ranking UI')

old = """                ))}
              </div>
            )}
          </div>"""
new = """                ))}
                </div>
              </>
            )}
          </div>"""
if old in s:
    # This marker is unique after the ranking table in the current source.
    s = s.replace(old, new, 1)

p.write_text(s)
print('nationality/ranking scope patch applied')

from pathlib import Path

p = Path('app/page.js')
s = p.read_text()

def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'Marker not found: {label}')
    s = s.replace(old, new, 1)

replace_once(
"import { supabase } from '../lib/supabaseClient';",
"import { supabase } from '../lib/supabaseClient';\nimport { COUNTRIES, countryFlag, countryName, normalizeNationalityCode } from '../lib/countries';\nimport { myGroupIds as getMyGroupIds, visiblePlayerIds, filterRankingGames } from '../lib/rankingScope';",
"imports")

replace_once(
"      <div className=\"sf-pcard-name\">{firstName}</div>",
"      <div className=\"sf-pcard-name\">{countryFlag(player.nationality_code)} {firstName}</div>",
"player card flag")

replace_once(
"  const [pixDraft, setPixDraft] = useState(me.pix_key || '');",
"  const [pixDraft, setPixDraft] = useState(me.pix_key || '');\n  const [nationalityDraft, setNationalityDraft] = useState(normalizeNationalityCode(me.nationality_code));",
"nationality state")

replace_once(
"      <div className=\"sf-h3\">{me.name} <span className=\"sf-me-tag\">você</span></div>",
"      <div className=\"sf-h3\">{countryFlag(me.nationality_code)} {me.name} <span className=\"sf-me-tag\">você</span></div>\n      <div className=\"sf-muted-sm\" style={{ margin: '8px 0 6px' }}>Nacionalidade</div>\n      <select className=\"sf-input\" value={nationalityDraft} onChange={(e) => { const code = normalizeNationalityCode(e.target.value); setNationalityDraft(code); onUpdate({ nationality_code: code }); }}>\n        {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{countryFlag(code)} {name}</option>)}\n      </select>",
"nationality selector")

replace_once(
"  const [elencoGroupFilter, setElencoGroupFilter] = useState('all');",
"  const [elencoGroupFilter, setElencoGroupFilter] = useState('all');\n  const [rankingGroupFilter, setRankingGroupFilter] = useState('all');",
"ranking filter state")

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
new = """  const myGroupIds = useMemo(() => getMyGroupIds(groupMembers, groups, myId), [groupMembers, groups, myId]);
  const rankingVisibleIds = useMemo(() => visiblePlayerIds({ groupMembers, groups, myId, groupId: rankingGroupFilter }), [groupMembers, groups, myId, rankingGroupFilter]);
  const ranking = useMemo(() => {
    const scopedProfiles = profiles.filter((p) => rankingVisibleIds.has(p.id));
    const scopedGames = filterRankingGames(games, rankingVisibleIds, rankingGroupFilter);
    return computeRanking(scopedProfiles, scopedGames);
  }, [profiles, games, rankingVisibleIds, rankingGroupFilter]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingGames = useMemo(() => [...games].filter((g) => g.date >= todayIso).sort((a, b) => (a.date > b.date ? 1 : -1)), [games, todayIso]);
  const pastGames = useMemo(() => [...games].filter((g) => g.date < todayIso).sort((a, b) => (a.date < b.date ? 1 : -1)), [games, todayIso]);
  const sortedGames = partidasFilter === 'passadas' ? pastGames : upcomingGames;
  const selectedGame = games.find((g) => g.id === selectedGameId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
"""
replace_once(old, new, "ranking scope")

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
replace_once(old, new, "ranking UI start")
replace_once(
"""                {ranking.map((r, i) => (
                  <div key={r.id} className=\"sf-ranking-row\">
                    <span className=\"sf-rk-name\">
                      {i === 0 && r.pontos > 0 ? '🏆 ' : ''}{r.name}{r.mvps > 0 ? <span className=\"sf-mvp-tag\"> ⭐×{r.mvps}</span> : ''}""",
"""                {ranking.map((r, i) => (
                  <div key={r.id} className=\"sf-ranking-row\">
                    <span className=\"sf-rk-name\">
                      {i === 0 && r.pontos > 0 ? '🏆 ' : ''}{countryFlag(profiles.find((p) => p.id === r.id)?.nationality_code)} {r.name}{r.mvps > 0 ? <span className=\"sf-mvp-tag\"> ⭐×{r.mvps}</span> : ''}""",
"ranking row flag")
replace_once(
"""                ))}
              </div>
            )}
          </div>""",
"""                ))}
                </div>
              </>
            )}
          </div>""",
"ranking UI close")

p.write_text(s)

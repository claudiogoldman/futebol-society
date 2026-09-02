from pathlib import Path
import re

path = Path('app/society-page.js')
s = path.read_text()

def replace(pattern, replacement, label, flags=re.S):
    global s
    out, count = re.subn(pattern, replacement, s, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'Patch target not found: {label}')
    s = out

replace(
    r"  // preserve RSVP order .*?\n  const waitlistPlayers = maxPlayers \? confirmedPlayers\.slice\(maxPlayers\) : \[\];",
    "  // The persistent game_waitlist table is the source of truth for substitutes.\n  const waitlistIds = game.waitlist || [];\n  const waitlistPlayers = waitlistIds.map((id) => roster.find((p) => p.id === id)).filter(Boolean);",
    'GameDetail waitlist source',
)
replace(
    r"  const iAmConfirmed = game\.confirmed\.includes\(myId\);\n  const myWaitlistPos = waitlistPlayers\.findIndex\(\(p\) => p\.id === myId\);",
    "  const iAmConfirmed = game.confirmed.includes(myId);\n  const iAmWaitlisted = waitlistIds.includes(myId);\n  const myWaitlistPos = waitlistIds.findIndex((id) => id === myId);",
    'RSVP waitlist state',
)
replace(
    r"<button className=\{`sf-btn-primary \$\{iAmConfirmed \? 'sf-btn-toggle-on' : ''\}`\} onClick=\{\(\) => onToggleMyRSVP\(game\.id\)\}>.*?</button>",
    "<button className={`sf-btn-primary ${(iAmConfirmed || iAmWaitlisted) ? 'sf-btn-toggle-on' : ''}`} onClick={() => onToggleMyRSVP(game.id)}>\n          {iAmConfirmed ? <><Check size={16} /> Você tá confirmado</> : iAmWaitlisted ? <><Clock3 size={16} /> Você tá na espera (#{myWaitlistPos + 1})</> : 'Confirmar minha presença'}\n        </button>",
    'RSVP button',
)
replace(
    r"<button className=\"sf-btn-ghost\" disabled=\{!participantDraft\} onClick=\{async \(\) => \{ await onAddParticipant\(game\.id, participantDraft\); setParticipantDraft\(''\); \}\}>Adicionar</button>",
    "<button className=\"sf-btn-ghost\" disabled={!participantDraft} onClick={async () => { await onAddParticipant(game.id, participantDraft); setParticipantDraft(''); }}>Adicionar jogador</button>",
    'participant label',
    flags=0,
)
replace(
    r"const save = \(\) => \{\n    onSetDefaults\(group\.id, \{",
    "const save = async () => {\n    const ok = await onSetDefaults(group.id, {",
    'group save start',
)
replace(
    r"(avatar_url: avatarUrlDraft \|\| null,\n    \}\);\n)    setEditing\(false\);",
    r"\1    if (ok) setEditing(false);",
    'group save result',
)
marker = "  const canManage = isOwner || myMembership?.role === 'admin';\n"
if s.count(marker) != 1:
    raise SystemExit('Group state marker not found')
s = s.replace(marker, marker + """  useEffect(() => {
    setNameDraft(group.name || '');
    setDayDraft(group.defaultDayOfWeek != null ? String(group.defaultDayOfWeek) : '');
    setTimeDraft(group.defaultTime || '');
    setMaxPlayersDraft(group.defaultMaxPlayers ? String(group.defaultMaxPlayers) : '');
    setCostDraft(group.defaultCost != null ? String(group.defaultCost) : '');
    setGoalkeeperPaysDraft(group.defaultGoalkeeperPays !== false);
    setPixKeyDraft(group.defaultPixKey || '');
    setPixReceiverDraft(group.defaultPixReceiverName || '');
    setPixCityDraft(group.defaultPixCity || '');
    setOrganizerDraft(group.defaultOrganizerId || '');
    setAvatarDraft(group.avatar || null);
    setAvatarUrlDraft(group.avatarUrl || '');
    setEditing(false);
  }, [group.id]);

""", 1)
replace(
    r"const setCost = async \(gameId, cost\) => \{.*?const setGkPays = async \(gameId, goalkeeper_pays\) => \{.*?\n  \};",
    """const setCost = async (gameId, cost) => {
    const { error } = await supabase.from('games').update({ cost }).eq('id', gameId);
    if (error) { alert('Não foi possível alterar o custo da partida: ' + error.message); return false; }
    await loadAll();
    return true;
  };

  const setGkPays = async (gameId, goalkeeper_pays) => {
    const { error } = await supabase.from('games').update({ goalkeeper_pays }).eq('id', gameId);
    if (error) { alert('Não foi possível alterar se o goleiro paga: ' + error.message); return false; }
    await loadAll();
    return true;
  };""",
    'game settings handlers',
)
replace(
    r"const setMaxPlayers = async \(gameId, maxPlayers\) => \{.*?\n  \};",
    """const setMaxPlayers = async (gameId, maxPlayers) => {
    const { error } = await supabase.from('games').update({ max_players: maxPlayers }).eq('id', gameId);
    if (error) { alert('Não foi possível alterar o limite de vagas: ' + error.message); return false; }
    await loadAll();
    return true;
  };""",
    'max players handler',
)
replace(
    r"const setGroupDefaults = async \(groupId, fields\) => \{.*?\n  \};",
    """const setGroupDefaults = async (groupId, fields) => {
    const { error } = await supabase.from('groups').update(fields).eq('id', groupId);
    if (error) { alert('Não foi possível salvar os padrões do grupo: ' + error.message); return false; }
    await loadAll();
    return true;
  };""",
    'group defaults handler',
)
replace(
    r"const \[profilesRes, gamesRes, confRes, teamsRes, paysRes, goalsRes, ratingsRes, groupsRes, groupMembersRes, groupLocationsRes\]",
    "const [profilesRes, gamesRes, confRes, waitlistRes, teamsRes, paysRes, goalsRes, ratingsRes, groupsRes, groupMembersRes, groupLocationsRes]",
    'waitlist state',
    flags=0,
)
replace(
    r"(supabase\.from\('game_confirmations'\)\.select\('\*'\),\n)(\s+supabase\.from\('game_teams'\))",
    r"\1      supabase.from('game_waitlist').select('*').order('queued_at', { ascending: true }).order('id', { ascending: true }),\n\2",
    'waitlist query',
)
replace(
    r"(const teamRows = \(teamsRes\.data \|\| \[\]\)\.filter\(\(t\) => t\.game_id === g\.id\);)",
    r"const waitlist = (waitlistRes.data || []).filter((w) => w.game_id === g.id).sort((a, b) => new Date(a.queued_at) - new Date(b.queued_at) || String(a.id).localeCompare(String(b.id))).map((w) => w.user_id);\n      \1",
    'waitlist assembly',
)
if '        confirmed, teamA, teamB, payments, scorers, assists, ratings,' not in s:
    raise SystemExit('Game mapping target not found')
s = s.replace(
    '        confirmed, teamA, teamB, payments, scorers, assists, ratings,',
    '        confirmed, waitlist, teamA, teamB, payments, scorers, assists, ratings,',
    1,
)
replace(
    r"const toggleMyRSVP = async \(gameId\) => \{.*?\n  \};",
    """const toggleMyRSVP = async (gameId) => {
    const g = games.find((x) => x.id === gameId);
    if (!g) return;
    let error = null;
    if (g.confirmed.includes(myId)) {
      ({ error } = await supabase.from('game_confirmations').delete().eq('game_id', gameId).eq('user_id', myId));
    } else if ((g.waitlist || []).includes(myId)) {
      ({ error } = await supabase.from('game_waitlist').delete().eq('game_id', gameId).eq('user_id', myId));
    } else {
      ({ error } = await supabase.from('game_confirmations').insert({ game_id: gameId, user_id: myId }));
    }
    if (error) { alert('Não foi possível alterar sua presença: ' + error.message); return; }
    await loadAll();
  };""",
    'RSVP handler',
)
path.write_text(s)
print('consistency refactor patch applied')

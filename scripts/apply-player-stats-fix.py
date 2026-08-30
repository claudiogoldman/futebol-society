from pathlib import Path

path = Path('app/page.js')
s = path.read_text(encoding='utf-8')

# 1) GameDetail receives a callback dedicated to the logged-in player's own stats.
old = "function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onSetGameLocation, onDraw, onTogglePaid, onSaveResult, onSaveRatings, onDelete, onShare }) {"
new = "function GameDetail({ game, roster, myId, isAdmin, onBack, onToggleMyRSVP, onSetCost, onSetGkPays, onSetMaxPlayers, onSetGamePixDetails, onSetGameLocation, onDraw, onTogglePaid, onSaveResult, onSavePlayerStats, onSaveRatings, onDelete, onShare }) {"
if old in s:
    s = s.replace(old, new, 1)
elif 'onSavePlayerStats' not in s:
    raise SystemExit('GameDetail signature marker not found')

# 2) Local draft values for the logged-in player's goals/assists.
old = "  const [assists, setAssists] = useState(game.result?.scorers ? (game.assists || {}) : {});\n"
new = "  const [assists, setAssists] = useState(game.result?.scorers ? (game.assists || {}) : {});\n  const [myGoalsDraft, setMyGoalsDraft] = useState(game.result?.scorers?.[myId] || 0);\n  const [myAssistsDraft, setMyAssistsDraft] = useState(game.assists?.[myId] || 0);\n"
if old in s and 'myGoalsDraft' not in s:
    s = s.replace(old, new, 1)

# 3) Add the self-report card before the organizer-only correction UI.
marker = "      {hasTeams && canManage && (\n        <section className=\"sf-card\">\n          <div className=\"sf-card-title\"><Trophy size={16} /> Resultado</div>\n"
insert = """      {hasTeams && game.result && !canManage && allPlayers.some((p) => p.id === myId) && (\n        <section className=\"sf-card\">\n          <div className=\"sf-card-title\"><Trophy size={16} /> Meus gols e assistências</div>\n          <div className=\"sf-card-subtitle\">Informe apenas os seus números. O organizador pode corrigir o resultado quando necessário.</div>\n          <div className=\"sf-score-row\">\n            <div className=\"sf-score-box\">\n              <span>⚽ Gols</span>\n              <input type=\"number\" min=\"0\" className=\"sf-score-input\" value={myGoalsDraft} onChange={(e) => setMyGoalsDraft(Math.max(0, parseInt(e.target.value, 10) || 0))} />\n            </div>\n            <div className=\"sf-score-box\">\n              <span>🎯 Assistências</span>\n              <input type=\"number\" min=\"0\" className=\"sf-score-input\" value={myAssistsDraft} onChange={(e) => setMyAssistsDraft(Math.max(0, parseInt(e.target.value, 10) || 0))} />\n            </div>\n          </div>\n          <button className=\"sf-btn-primary\" onClick={() => onSavePlayerStats(game.id, myId, myGoalsDraft, myAssistsDraft)}>\n            <Check size={16} /> Salvar meus números\n          </button>\n        </section>\n      )}\n\n"""
if marker in s and 'Meus gols e assistências' not in s:
    s = s.replace(marker, insert + marker, 1)

# 4) MainApp persists only the player's own row for this self-report flow.
marker = "  const saveResult = async (gameId, scoreA, scoreB, scorers, assists, playerIds) => {\n"
insert = """  const savePlayerStats = async (gameId, userId, goals, assists) => {\n    const safeGoals = Math.max(0, parseInt(goals, 10) || 0);\n    const safeAssists = Math.max(0, parseInt(assists, 10) || 0);\n    const { error } = await supabase.from('goals').upsert({\n      game_id: gameId,\n      user_id: userId,\n      goals: safeGoals,\n      assists: safeAssists,\n    });\n    if (error) { alert('Não foi possível salvar seus gols/assistências: ' + error.message); return; }\n    loadAll();\n  };\n\n"""
if marker in s and 'const savePlayerStats = async' not in s:
    s = s.replace(marker, insert + marker, 1)

# 5) Wire the callback into GameDetail.
old = "            onSaveResult={saveResult}\n            onSaveRatings={saveRatings}\n"
new = "            onSaveResult={saveResult}\n            onSavePlayerStats={savePlayerStats}\n            onSaveRatings={saveRatings}\n"
if old in s and 'onSavePlayerStats={savePlayerStats}' not in s:
    s = s.replace(old, new, 1)

path.write_text(s, encoding='utf-8')
print('player stats patch applied')

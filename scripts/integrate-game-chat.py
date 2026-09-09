from pathlib import Path

path = Path('app/society-page.js')
text = path.read_text(encoding='utf-8')

old_import = "import PositionTags from '../components/players/PositionTags';\n"
new_import = old_import + "import GameChat from '../components/chat/GameChat';\n"
if "from '../components/chat/GameChat'" not in text:
    if old_import not in text:
        raise SystemExit('GameChat import anchor not found; aborting without changes.')
    text = text.replace(old_import, new_import, 1)

marker = "      <section className=\"sf-card\">\n        <div className=\"sf-card-title\">\n          <Users size={16} /> Confirmados ({activePlayers.length}{maxPlayers ? f\"/{maxPlayers}\" : ''})\n"
if "<GameChat" not in text:
    chat = "      {iAmConfirmed && (\n        <GameChat\n          gameId={game.id}\n          userId={myId}\n          playerNames={Object.fromEntries(roster.map((p) => [p.id, p.name]))}\n        />\n      )}\n\n"
    if marker not in text:
        raise SystemExit('GameDetail confirmed-section anchor not found; aborting without changes.')
    text = text.replace(marker, chat + marker, 1)

path.write_text(text, encoding='utf-8')
print('GameChat integration applied.')

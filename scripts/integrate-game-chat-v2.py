from pathlib import Path
import re

path = Path('app/society-page.js')
text = path.read_text(encoding='utf-8')

# Integrate the chat import without depending on the exact surrounding imports.
if "from '../components/chat/GameChat'" not in text:
    import_match = re.search(r"^import PositionTags from ['\"]\.\./components/players/PositionTags['\"];\s*$", text, re.MULTILINE)
    if not import_match:
        raise SystemExit('GameChat import anchor not found; aborting without changes.')
    text = text[:import_match.end()] + "\nimport GameChat from '../components/chat/GameChat';" + text[import_match.end():]

# The previous version depended on an exact Confirmados markup string. Keep the
# insertion anchored to the GameDetail confirmed-player card while tolerating
# harmless JSX/formatting changes inside the title.
if '<GameChat' not in text:
    section_match = re.search(
        r'(?s)(\s*<section className=[\"\']sf-card[\"\'](?:(?!<section className=[\"\']sf-card[\"\']).){0,3000}?Confirmados)'
        , text,
    )
    if not section_match:
        raise SystemExit('GameDetail confirmed-section anchor not found; aborting without changes.')

    chat = '''\n\n      {iAmConfirmed && (\n        <GameChat\n          gameId={game.id}\n          userId={myId}\n          playerNames={Object.fromEntries(roster.map((p) => [p.id, p.name]))}\n        />\n      )}'''
    text = text[:section_match.start()] + chat + text[section_match.start():]

path.write_text(text, encoding='utf-8')
print('GameChat integration applied.')

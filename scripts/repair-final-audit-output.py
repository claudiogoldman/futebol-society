from pathlib import Path
p = Path('app/page.js')
s = p.read_text()

# finalize-current-audit runs after the legacy game-management patch. If the
# legacy patch already supplied these handlers, keep the newest implementation
# (the last definition) and remove earlier duplicates before Next compiles.
for name in ('addParticipant', 'removeParticipant', 'addGuest'):
    marker = f'  const {name} = async '
    positions = []
    start = 0
    while True:
        i = s.find(marker, start)
        if i < 0:
            break
        positions.append(i)
        start = i + len(marker)
    if len(positions) > 1:
        first, second = positions[-2], positions[-1]
        # Remove the complete earlier definition, preserving the newest one.
        end = s.find('\n  const ', first + len(marker))
        if end >= 0 and end <= second:
            s = s[:first] + s[end + 1:]

p.write_text(s)
print('deduplicated final audit handlers')

from pathlib import Path
p = Path('app/page.js')
s = p.read_text()
for line in (
    "  const [participantDraft, setParticipantDraft] = useState('');\n",
    "  const [guestNameDraft, setGuestNameDraft] = useState('');\n",
    "  const [guestEmailDraft, setGuestEmailDraft] = useState('');\n",
):
    first = s.find(line)
    if first >= 0:
        rest = s[first + len(line):].replace(line, '')
        s = s[:first + len(line)] + rest
p.write_text(s)
print('deduplicated final audit state')

from pathlib import Path
p = Path('scripts/finalize-current-audit.py')
s = p.read_text()
s = s.replace('nonce(', 'once(')
p.write_text(s)
print('repaired final audit script helper')

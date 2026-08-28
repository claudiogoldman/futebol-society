from pathlib import Path
p = Path('app/page.js')
s = p.read_text()
old = """  const isOwner = myId === group.createdBy;
  const myRole = isOwner ? 'owner' : (memberRoles[myId] || 'member');
  const canManage = isOwner || myRole === 'admin';
  const myMembership = members.find((m) => m.user_id === myId || m.userId === myId);
  const canManage = isOwner || myMembership?.role === 'admin';"""
new = """  const isOwner = myId === group.createdBy;
  const myRole = isOwner ? 'owner' : (memberRoles?.[myId] || 'member');
  const myMembership = members.find((m) => m.user_id === myId || m.userId === myId);
  const canManage = isOwner || myRole === 'admin' || myMembership?.role === 'admin';"""
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s)
print('normalized group management state')

const fs = require('fs');

const path = 'app/page.js';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`Pattern not found: ${label}`);
  s = s.replace(from, to);
}

replaceOnce(
  'function GroupDetail({ group, games, members, myId, onBack, onSetDefaults, onShare, onNewGame, onOpenGame, onLeave, onDelete }) {',
  'function GroupDetail({ group, games, members, myId, onBack, onSetDefaults, onShare, onNewGame, onOpenGame, onLeave, onDelete, onRemoveMember }) {',
  'GroupDetail signature'
);

replaceOnce(
  "  const isOwner = myId === group.createdBy;\n  const myMembership = members.find((m) => m.user_id === myId || m.userId === myId);\n  const canManage = isOwner || myMembership?.role === 'admin';",
  "  const isOwner = myId === group.createdBy;\n  const myMembership = members.find((m) => m.user_id === myId || m.userId === myId);\n  const canManage = isOwner || myMembership?.role === 'admin';",
  'group permission block'
);

replaceOnce(
  `          {members.map((m) => (\n            <div key={m.id} className={\`sf-rsvp-row sf-rsvp-on \${m.id === myId ? 'sf-rsvp-me' : ''}\`}>\n              <span className="sf-rsvp-name">{m.name}{m.id === myId ? ' (você)' : ''}{m.id === group.createdBy ? ' · dono' : ''}</span>\n            </div>\n          ))}`,
  `          {members.map((m) => (\n            <div key={m.id} className={\`sf-rsvp-row sf-rsvp-on \${m.id === myId ? 'sf-rsvp-me' : ''}\`}>\n              <span className="sf-rsvp-name">{m.name}{m.id === myId ? ' (você)' : ''}{m.id === group.createdBy ? ' · dono' : ''}{m.role === 'admin' && m.id !== group.createdBy ? ' · admin' : ''}</span>\n              {canManage && m.id !== group.createdBy && m.id !== myId && (\n                <button\n                  type="button"\n                  className="sf-admin-toggle"\n                  style={{ marginLeft: 'auto' }}\n                  onClick={() => {\n                    if (confirm(\`Remover \${m.name} deste grupo?\`)) onRemoveMember(group.id, m.id);\n                  }}\n                >\n                  Remover\n                </button>\n              )}\n            </div>\n          ))}`,
  'group member list'
);

replaceOnce(
  `  const leaveGroup = async (groupId) => {\n    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', myId);\n    setSelectedGroupId(null);\n    loadAll();\n  };`,
  `  const leaveGroup = async (groupId) => {\n    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', myId);\n    if (error) { alert('Não foi possível sair do grupo: ' + error.message); return; }\n    setSelectedGroupId(null);\n    await loadAll();\n  };\n\n  const removeGroupMember = async (groupId, userId) => {\n    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);\n    if (error) { alert('Não foi possível remover o membro: ' + error.message); return; }\n    await loadAll();\n  };`,
  'leave/remove member handlers'
);

replaceOnce(
  `            members={groupMembers.filter((m) => m.group_id === selectedGroup.id).map((m) => profiles.find((p) => p.id === m.user_id)).filter(Boolean)}\n            myId={myId}`,
  `            members={groupMembers.filter((m) => m.group_id === selectedGroup.id).map((m) => {\n              const profile = profiles.find((p) => p.id === m.user_id);\n              return profile ? { ...profile, user_id: m.user_id, role: m.role || 'member', membershipId: m.id } : null;\n            }).filter(Boolean)}\n            myId={myId}`,
  'enriched group members'
);

replaceOnce(
  `            onLeave={leaveGroup}\n            onDelete={deleteGroup}`,
  `            onLeave={leaveGroup}\n            onDelete={deleteGroup}\n            onRemoveMember={removeGroupMember}`,
  'GroupDetail remove callback'
);

fs.writeFileSync(path, s);
console.log('Applied group member management changes.');

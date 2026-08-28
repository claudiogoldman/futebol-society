export function myGroupIds(groupMembers, groups, myId) {
  const ids = new Set((groupMembers || []).filter((member) => member.user_id === myId).map((member) => member.group_id));
  (groups || []).filter((group) => group.createdBy === myId).forEach((group) => ids.add(group.id));
  return ids;
}

export function visiblePlayerIds({ groupMembers, groups, myId, groupId = 'all' }) {
  const mine = myGroupIds(groupMembers, groups, myId);
  const scoped = groupId === 'all'
    ? mine
    : new Set(mine.has(groupId) ? [groupId] : []);
  const ids = new Set([myId]);
  (groupMembers || []).forEach((member) => {
    if (scoped.has(member.group_id)) ids.add(member.user_id);
  });
  return ids;
}

export function filterRankingGames(games, visibleIds, groupId = 'all') {
  return (games || []).filter((game) => {
    if (groupId !== 'all' && game.groupId !== groupId) return false;
    const players = [...(game.teamA || []), ...(game.teamB || [])];
    return players.some((player) => visibleIds.has(player.id));
  });
}

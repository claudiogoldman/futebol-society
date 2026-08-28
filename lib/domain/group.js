export const GROUP_AVATARS = ['⚽', '🟢', '🔴', '🔵', '🟡', '🟣', '🦁', '🐺', '🦅', '🔥'];

export function groupFinancialDefaults(group = {}) {
  return {
    cost: Number(group.defaultCost ?? group.default_cost ?? 0) || 0,
    goalkeeperPays: (group.defaultGoalkeeperPays ?? group.default_goalkeeper_pays) !== false,
    pixKey: group.defaultPixKey ?? group.default_pix_key ?? null,
    pixReceiverName: group.defaultPixReceiverName ?? group.default_pix_receiver_name ?? null,
    pixCity: group.defaultPixCity ?? group.default_pix_city ?? null,
    pixOwnerId: group.defaultPixOwnerId ?? group.default_pix_owner_id ?? null,
  };
}

export function groupRole(member, group) {
  if (!member || !group) return 'member';
  if (member.user_id === (group.createdBy ?? group.created_by)) return 'owner';
  return member.role === 'admin' ? 'admin' : 'member';
}

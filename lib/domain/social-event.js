export const SOCIAL_EVENT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
});

export const SOCIAL_GUEST_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
});

export function canChangeGuestStatus(eventStatus, nextGuestStatus) {
  return eventStatus === SOCIAL_EVENT_STATUS.OPEN &&
    Object.values(SOCIAL_GUEST_STATUS).includes(nextGuestStatus);
}

export function canReopenSocialEvent(eventStatus, closureType) {
  return eventStatus === SOCIAL_EVENT_STATUS.CLOSED && closureType === 'MANUAL';
}

export function getAutomaticClosure(eventStatus, eventStart, now = new Date()) {
  if (eventStatus !== SOCIAL_EVENT_STATUS.OPEN) return false;
  const start = eventStart instanceof Date ? eventStart : new Date(eventStart);
  if (Number.isNaN(start.getTime())) return false;
  return now.getTime() >= start.getTime();
}

export function getPublicGuestNames(guests = []) {
  return guests
    .filter((guest) => guest.status === SOCIAL_GUEST_STATUS.CONFIRMED)
    .map((guest) => guest.name);
}

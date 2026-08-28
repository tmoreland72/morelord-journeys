function activeUsers(users) {
  return Array.from(users ?? []).filter(user => user?.active);
}

export function activeGM({ users = globalThis.game?.users } = {}) {
  return activeUsers(users).find(user => user.isGM) ?? null;
}

export function activePlayerForActor(actor, { users = globalThis.game?.users } = {}) {
  if (!actor) return null;
  const players = activeUsers(users).filter(user => !user.isGM);
  return players.find(user => user.character?.uuid === actor.uuid)
    ?? players.find(user => actor.testUserPermission?.(user, "OWNER"))
    ?? null;
}

export function requestRecipientForActor(actor, {
  users = globalThis.game?.users,
  requestingUser = globalThis.game?.user
} = {}) {
  const player = activePlayerForActor(actor, { users });
  if (player) return { user: player, fallbackToGM: false };
  const gm = requestingUser?.active && requestingUser.isGM
    ? requestingUser
    : activeUsers(users).find(user => user.isGM) ?? null;
  return gm ? { user: gm, fallbackToGM: true } : null;
}

export function firstPartyRequestRecipient(actors, options = {}) {
  for (const actor of actors ?? []) {
    const player = activePlayerForActor(actor, options);
    if (player) return { user: player, actor, fallbackToGM: false };
  }
  const actor = Array.from(actors ?? [])[0] ?? null;
  const fallback = requestRecipientForActor(actor, options);
  return fallback ? { ...fallback, actor } : null;
}

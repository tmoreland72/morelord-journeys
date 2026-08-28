export function validateExpeditionRoles({ navigatorUuid, observerUuid }, { requireBoth = true } = {}) {
  if (requireBoth && (!navigatorUuid || !observerUuid)) throw new Error("Assign a Navigator and Observer.");
  if (navigatorUuid && observerUuid && navigatorUuid === observerUuid) throw new Error("The Navigator and Observer must be different characters.");
  return { navigatorUuid, observerUuid };
}

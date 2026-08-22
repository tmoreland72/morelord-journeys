export class Dnd5eJourneyAdapter {
  getAvailableTravelers() {
    if (game.system.id !== "dnd5e") return [];

    const groups = game.actors.filter(actor => actor.type === "group");
    const orderedGroups = [game.actors.party, ...groups]
      .filter((group, index, entries) => group && entries.indexOf(group) === index);

    for (const group of orderedGroups) {
      const members = this.#characterMembers(group);
      if (members.length) {
        return members
          .sort((left, right) => left.name.localeCompare(right.name))
          .map(actor => this.#candidate(actor, { selectedByDefault: true, group }));
      }
    }

    return game.actors
      .filter(actor => actor.type === "character" && actor.hasPlayerOwner)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(actor => this.#candidate(actor, { selectedByDefault: true }));
  }

  snapshotTraveler(actor) {
    return {
      actorUuid: actor.uuid,
      actorId: actor.id,
      name: actor.name,
      img: this.#tokenImage(actor),
      type: actor.type
    };
  }

  async rollNavigation(journey) {
    const actorUuid = journey?.roles?.navigatorUuid;
    if (!actorUuid) throw new Error("Assign a navigator before rolling Navigation.");
    const actor = await fromUuid(actorUuid);
    if (!actor) throw new Error("The assigned navigator could not be found.");
    if (typeof actor.rollSkill !== "function") throw new Error(`${actor.name} cannot make a D&D 5e Survival check.`);

    const dc = journey.routeSnapshot.navigationDC;
    if (dc === null) return { cancelled: false, actorUuid, actorName: actor.name, dc, total: null, outcome: "success" };
    const result = await actor.rollSkill(
      { skill: "sur", target: dc },
      { configure: true, title: `Navigate ${journey.routeSnapshot.name} — DC ${dc}` },
      { create: true, data: { flavor: `${actor.name} navigates ${journey.routeSnapshot.name} — DC ${dc}` } }
    );
    if (!result) return { cancelled: true };
    const roll = Array.isArray(result) ? result[0] : result?.rolls?.[0] ?? result?.roll ?? result;
    const total = Number(roll?.total ?? result?.total ?? Number.NaN);
    if (!Number.isFinite(total)) throw new Error("The Navigation roll did not return a numeric total.");
    const outcome = total >= dc ? "success" : total <= dc - 5 ? "reversed" : "lost";
    return { cancelled: false, actorUuid, actorName: actor.name, dc, total, outcome, roll };
  }

  #candidate(actor, { selectedByDefault, group = null }) {
    return {
      id: actor.id,
      uuid: actor.uuid,
      name: actor.name,
      img: this.#tokenImage(actor),
      hasPlayerOwner: Boolean(selectedByDefault),
      selectedByDefault: Boolean(selectedByDefault),
      groupId: group?.id ?? null,
      groupName: group?.name ?? null
    };
  }

  #characterMembers(group) {
    const direct = Array.from(group?.system?.playerCharacters ?? []);
    if (direct.length) return direct;
    return Array.from(group?.system?.members ?? [])
      .map(member => member?.actor)
      .filter(actor => actor?.type === "character");
  }

  #tokenImage(actor) {
    return actor?.prototypeToken?.texture?.src || actor?.img || "icons/svg/mystery-man.svg";
  }
}

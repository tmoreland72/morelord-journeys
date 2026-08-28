import { naturalD20 } from "../domain/d20-roll.mjs";
import { navigationOutcome } from "../domain/navigation-rules.mjs";

export class Dnd5eJourneyAdapter {
  getAvailableTravelers() {
    if (game.system.id !== "dnd5e") return [];

    const groups = game.actors.filter(actor => actor.type === "group");
    const orderedGroups = [game.actors.party, ...groups]
      .filter((group, index, entries) => group && entries.indexOf(group) === index);

    const primaryGroup = orderedGroups.find(group => this.#characterMembers(group).length) ?? null;
    const groupMembers = primaryGroup ? this.#characterMembers(primaryGroup) : [];
    const groupMemberUuids = new Set(groupMembers.map(actor => actor.uuid));
    const candidates = new Map();
    for (const actor of groupMembers) candidates.set(actor.uuid, actor);
    for (const actor of game.actors.filter(actor => actor.type === "character" && actor.hasPlayerOwner)) candidates.set(actor.uuid, actor);

    return [...candidates.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(actor => this.#candidate(actor, {
        selectedByDefault: primaryGroup ? groupMemberUuids.has(actor.uuid) : true,
        group: groupMemberUuids.has(actor.uuid) ? primaryGroup : null
      }));
  }

  snapshotTraveler(actor, { longRestHours = null } = {}) {
    const requirement = this.getLongRestRequirement(actor);
    const selectedHours = Number(longRestHours);
    const hours = Number.isFinite(selectedHours) && selectedHours > 0 ? selectedHours : requirement.hours;
    return {
      actorUuid: actor.uuid,
      actorId: actor.id,
      name: actor.name,
      img: this.#tokenImage(actor),
      type: actor.type,
      longRestHours: hours,
      longRestHoursGuess: requirement.hours,
      longRestHoursSource: hours === requirement.hours ? requirement.source : `GM-adjusted during expedition setup; initial guess ${requirement.hours} hours from ${requirement.source}`
    };
  }

  getLongRestRequirement(actor) {
    const override = Number(actor?.getFlag?.("morelord-journeys", "longRestHours"));
    if (Number.isFinite(override) && override > 0) return { hours: override, source: "Journeys actor override" };
    const trance = Array.from(actor?.items ?? []).find(item => {
      const identifier = String(item?.system?.identifier ?? "").trim().toLowerCase();
      return identifier === "trance" || String(item?.name ?? "").trim().toLowerCase() === "trance";
    });
    if (trance) return { hours: 4, source: trance.name || "Trance" };
    return { hours: 6, source: "Standard Long Rest sleep requirement" };
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
    const natural = naturalD20(roll);
    const outcome = navigationOutcome({ total, dc, natural });
    return { cancelled: false, actorUuid, actorName: actor.name, dc, total, natural, outcome, roll };
  }

  #candidate(actor, { selectedByDefault, group = null }) {
    const rest = this.getLongRestRequirement(actor);
    return {
      id: actor.id,
      uuid: actor.uuid,
      name: actor.name,
      img: this.#tokenImage(actor),
      hasPlayerOwner: Boolean(selectedByDefault),
      selectedByDefault: Boolean(selectedByDefault),
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      longRestHours: rest.hours,
      longRestHoursSource: rest.source
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

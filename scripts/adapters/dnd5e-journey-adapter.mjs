import { listCharacterActors, listCharacterChoices, primaryPartyGroup } from "../../../morelord-core/scripts/ui/actor-participation.js";
import { naturalD20 } from "../domain/d20-roll.mjs";
import { navigationOutcome } from "../domain/navigation-rules.mjs";

export class Dnd5eJourneyAdapter {
  getAvailableTravelers() {
    if (game.system.id !== "dnd5e") return [];

    const party = primaryPartyGroup();
    const choices = new Map(listCharacterChoices().map(choice => [choice.uuid, choice]));
    return listCharacterActors().map(actor => this.#candidate(actor, {
      selectedByDefault: choices.get(actor.uuid).checked,
      group: choices.get(actor.uuid).groupId ? party : null
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

  #tokenImage(actor) {
    return actor?.prototypeToken?.texture?.src || actor?.img || "icons/svg/mystery-man.svg";
  }
}

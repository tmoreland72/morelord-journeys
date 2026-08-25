const SUPPLY_CATEGORIES = Object.freeze([
  { id: "food", label: "Food", matches: (name) => /\bration(s)?\b|\bfood\b/.test(name) },
  { id: "water", label: "Water", matches: (name, item) => /^water\s*\((?:1\s*)?pints?\)$/.test(name) || /^(?:water-)?pint(?:-of-water)?$/.test(String(item.system?.identifier ?? "").toLowerCase()) || Number.isFinite(Number(item.flags?.["morelord-journeys"]?.waterUnits)) },
  { id: "tent", label: "Tents", matches: (name) => /\btent\b/.test(name) },
  { id: "bedroll", label: "Bedrolls", matches: (name) => /bedroll/.test(name) },
  { id: "blanket", label: "Blankets", matches: (name) => /blanket/.test(name) }
]);

export class SupplyManifestService {
  static WATER_CONTAINER_CAPACITY = Object.freeze([
    { pattern: /waterskin/i, pints: 4 },
    { pattern: /flask/i, pints: 1 },
    { pattern: /jug/i, pints: 8 },
    { pattern: /barrel/i, pints: 320 }
  ]);

  static waterContainerPints(item) {
    return this.WATER_CONTAINER_CAPACITY.find(entry => entry.pattern.test(item?.name ?? ""))?.pints ?? 0;
  }

  findPartyActor(travelerUuids = []) {
    const selected = new Set(travelerUuids);
    const groups = game.actors.filter(actor => actor.type === "group");
    const ordered = [game.actors.party, ...groups]
      .filter((group, index, entries) => group && entries.indexOf(group) === index);
    return ordered.find(group => {
      const members = this.#groupCharacters(group);
      return members.length && members.some(actor => selected.has(actor.uuid));
    }) ?? null;
  }

  async build({ travelerUuids = [], partyActorUuid = null } = {}) {
    const partyActor = partyActorUuid ? await fromUuid(partyActorUuid) : this.findPartyActor(travelerUuids);
    const travelers = (await Promise.all(travelerUuids.map(uuid => fromUuid(uuid)))).filter(Boolean);
    const sources = [];
    if (partyActor) sources.push({ actor: partyActor, sourceType: "group" });
    for (const actor of travelers) {
      if (!sources.some(source => source.actor.uuid === actor.uuid)) {
        sources.push({ actor, sourceType: "traveler" });
      }
    }

    const items = [];
    for (const source of sources) {
      const sourceItems = Array.from(source.actor.items ?? []);
      const containersWithWaterItems = new Set(sourceItems
        .filter(item => this.#category(item)?.id === "water" && item.system?.container)
        .map(item => String(item.system.container)));
      for (const item of sourceItems) {
        const category = this.#category(item);
        if (!category) continue;
        const containerId = String(item.id ?? item._id ?? "");
        const containerUuid = String(item.uuid ?? "");
        if (category.id === "water" && Number.isFinite(Number(item.flags?.["morelord-journeys"]?.waterUnits))
          && (containersWithWaterItems.has(containerId) || containersWithWaterItems.has(containerUuid))) continue;
        const rawQuantity = item.system?.quantity?.value ?? item.system?.quantity ?? 1;
        const quantity = Math.max(0, Number(rawQuantity) || 0);
        const availability = this.#availability(item, category.id, quantity);
        items.push({
          category: category.id,
          categoryLabel: category.label,
          itemUuid: item.uuid,
          name: item.name,
          img: item.img,
          quantity,
          availableQuantity: availability.quantity,
          supplyState: availability.state,
          sourceActorUuid: source.actor.uuid,
          sourceActorName: source.actor.name,
          sourceType: source.sourceType
        });
      }
    }

    const totals = Object.fromEntries(SUPPLY_CATEGORIES.map(category => [category.id, 0]));
    for (const item of items) totals[item.category] += item.availableQuantity;
    return {
      food: totals.food,
      water: totals.water,
      waterUnits: Math.floor(totals.water / 4),
      totals,
      items,
      sources: sources.map(({ actor, sourceType }) => ({
        actorUuid: actor.uuid,
        actorName: actor.name,
        sourceType
      })),
      partyActorUuid: partyActor?.uuid ?? null,
      capturedAt: Date.now()
    };
  }

  async refillTravelerContainers(travelerUuids = []) {
    const refilled = [];
    for (const actorUuid of travelerUuids) {
      const actor = await fromUuid(actorUuid);
      if (!actor) continue;
      const actorItems = Array.from(actor.items ?? []);
      for (const item of actorItems) {
        const pints = SupplyManifestService.waterContainerPints(item);
        if (!pints) continue;
        const containerKeys = new Set([String(item.id ?? item._id ?? ""), String(item.uuid ?? "")]);
        const containedWater = actorItems.filter(candidate => containerKeys.has(String(candidate.system?.container ?? "")) && this.#category(candidate)?.id === "water");
        if (containedWater.length) {
          for (const [index, water] of containedWater.entries()) {
            const wrapped = water.system?.quantity && typeof water.system.quantity === "object";
            await water.update({ [wrapped ? "system.quantity.value" : "system.quantity"]: index === 0 ? pints : 0 });
          }
        } else await item.update({ "flags.morelord-journeys.waterUnits": pints, "flags.morelord-journeys.waterState": "full" });
        refilled.push({ actorUuid, actorName: actor.name, itemUuid: item.uuid, itemName: item.name, pints });
      }
    }
    return refilled;
  }

  #category(item) {
    const normalized = String(item?.name ?? "").trim().toLowerCase();
    return SUPPLY_CATEGORIES.find(category => category.matches(normalized, item)) ?? null;
  }

  #availability(item, category, quantity) {
    if (category === "water" && Number.isFinite(Number(item.flags?.["morelord-journeys"]?.waterUnits))) {
      if (item.flags?.["morelord-journeys"]?.waterState === "empty") return { quantity: 0, state: "empty" };
      const units = Math.max(0, Number(item.flags["morelord-journeys"].waterUnits));
      return { quantity: units, state: units > 0 ? "available" : "empty" };
    }
    return { quantity, state: quantity > 0 ? "available" : "empty" };
  }

  #groupCharacters(group) {
    const direct = Array.from(group?.system?.playerCharacters ?? []);
    if (direct.length) return direct;
    return Array.from(group?.system?.members ?? [])
      .map(member => member?.actor)
      .filter(actor => actor?.type === "character");
  }
}

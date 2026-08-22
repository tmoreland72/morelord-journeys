const SUPPLY_CATEGORIES = Object.freeze([
  { id: "food", label: "Food", matches: name => /\bration(s)?\b|\bfood\b/.test(name) },
  { id: "water", label: "Water", matches: name => /waterskin|water skin|water flask|water barrel/.test(name) },
  { id: "tent", label: "Tents", matches: name => /\btent\b/.test(name) },
  { id: "bedroll", label: "Bedrolls", matches: name => /bedroll/.test(name) },
  { id: "blanket", label: "Blankets", matches: name => /blanket/.test(name) }
]);

export class SupplyManifestService {
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
      for (const item of Array.from(source.actor.items ?? [])) {
        const category = this.#category(item.name);
        if (!category) continue;
        const quantity = Math.max(0, Number(item.system?.quantity ?? 1) || 0);
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

  #category(name) {
    const normalized = String(name ?? "").trim().toLowerCase();
    return SUPPLY_CATEGORIES.find(category => category.matches(normalized)) ?? null;
  }

  #availability(item, category, quantity) {
    if (category !== "water") return { quantity, state: quantity > 0 ? "available" : "empty" };
    const name = String(item.name ?? "").toLowerCase();
    const flags = item.flags?.["morelord-journeys"] ?? {};
    const explicitUnits = Number(flags.waterUnits);
    if (Number.isFinite(explicitUnits)) {
      const units = Math.max(0, Math.min(quantity, explicitUnits));
      return { quantity: units, state: units > 0 ? "filled" : "empty" };
    }
    if (flags.waterState === "full") return { quantity, state: "filled" };
    if (flags.waterState === "empty" || /\bempty\b/.test(name)) return { quantity: 0, state: "empty" };

    const uses = item.system?.uses;
    const maximum = Number(uses?.max);
    const spent = Number(uses?.spent);
    if (Number.isFinite(maximum) && maximum > 0 && Number.isFinite(spent)) {
      const remaining = Math.max(0, maximum - spent);
      return { quantity: Math.min(quantity, remaining), state: remaining > 0 ? "filled" : "empty" };
    }
    const value = Number(uses?.value);
    if (Number.isFinite(value) && (Number.isFinite(maximum) ? maximum > 0 : true)) {
      return { quantity: Math.min(quantity, Math.max(0, value)), state: value > 0 ? "filled" : "empty" };
    }
    if (/\bfull\b|filled/.test(name)) return { quantity, state: "filled" };
    return { quantity: 0, state: "unknown" };
  }

  #groupCharacters(group) {
    const direct = Array.from(group?.system?.playerCharacters ?? []);
    if (direct.length) return direct;
    return Array.from(group?.system?.members ?? [])
      .map(member => member?.actor)
      .filter(actor => actor?.type === "character");
  }
}

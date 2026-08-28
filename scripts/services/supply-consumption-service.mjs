export class SupplyConsumptionService {
  planManualOutcomes({ travelers = [], fedActorUuids = [], wateredActorUuids = [] } = {}) {
    const travelerUuids = travelers.map(traveler => traveler.actorUuid);
    const fed = new Set(fedActorUuids);
    const watered = new Set(wateredActorUuids);
    const foodShortages = travelerUuids.filter(uuid => !fed.has(uuid));
    const waterShortages = travelerUuids.filter(uuid => !watered.has(uuid));
    return {
      resolutionMode: "manual",
      requirements: { food: travelerUuids.length, water: travelerUuids.length * 4 },
      allocations: [],
      shortages: { food: foodShortages.length, water: waterShortages.length },
      shortageActorUuids: { food: foodShortages, water: waterShortages },
      manual: { foodActorUuids: travelerUuids.filter(uuid => fed.has(uuid)), waterActorUuids: travelerUuids.filter(uuid => watered.has(uuid)) }
    };
  }

  planForTravelers(manifest, { travelers = [], foodActorUuids = [], waterActorUuids = [] } = {}) {
    const names = new Map(travelers.map(traveler => [traveler.actorUuid, traveler.name]));
    const available = new Map((manifest?.items ?? []).map(item => [item.itemUuid, Number(item.availableQuantity ?? 0)]));
    const allocations = [];
    const shortageActorUuids = { food: [], water: [] };
    for (const [category, actorUuids] of [["food", foodActorUuids], ["water", waterActorUuids]]) {
      for (const actorUuid of actorUuids) {
        let remaining = category === "water" ? 4 : 1;
        const candidates = (manifest?.items ?? [])
          .filter(item => item.category === category)
          .sort((left, right) => {
            const priority = item => item.sourceActorUuid === actorUuid ? 0 : item.sourceType === "group" ? 1 : 2;
            return priority(left) - priority(right);
          });
        for (const item of candidates) {
          const usable = available.get(item.itemUuid) ?? 0;
          const quantity = Math.min(remaining, usable);
          if (!quantity) continue;
          allocations.push({
            category,
            consumerActorUuid: actorUuid,
            consumerActorName: names.get(actorUuid) ?? "Traveler",
            itemUuid: item.itemUuid,
            itemName: item.name,
            sourceActorUuid: item.sourceActorUuid,
            sourceActorName: item.sourceActorName,
            sourceType: item.sourceType,
            availableQuantity: item.availableQuantity,
            quantity
          });
          available.set(item.itemUuid, usable - quantity);
          remaining -= quantity;
          if (!remaining) break;
        }
        if (remaining) shortageActorUuids[category].push(actorUuid);
      }
    }
    return {
      requirements: { food: foodActorUuids.length, water: waterActorUuids.length * 4 },
      allocations,
      shortages: { food: shortageActorUuids.food.length, water: shortageActorUuids.water.length },
      shortageActorUuids
    };
  }

  plan(manifest, requirements) {
    const allocations = [];
    const shortages = {};
    for (const category of ["food", "water"]) {
      let remaining = Math.max(0, Number(requirements?.[category] ?? 0));
      const candidates = (manifest?.items ?? [])
        .filter(item => item.category === category && item.availableQuantity > 0)
        .sort((left, right) => Number(right.sourceType === "group") - Number(left.sourceType === "group"));
      for (const item of candidates) {
        const quantity = Math.min(remaining, item.availableQuantity);
        allocations.push({
          category,
          itemUuid: item.itemUuid,
          itemName: item.name,
          sourceActorName: item.sourceActorName,
          availableQuantity: item.availableQuantity,
          quantity
        });
        remaining -= quantity;
      }
      shortages[category] = remaining;
    }
    return { requirements: { food: Number(requirements?.food ?? 0), water: Number(requirements?.water ?? 0) }, allocations, shortages };
  }

  async apply(plan) {
    for (const allocation of plan.allocations ?? []) {
      const quantity = Math.max(0, Number(allocation.quantity ?? 0));
      if (!quantity) continue;
      const item = await fromUuid(allocation.itemUuid);
      if (!item) throw new Error(`Supply item could not be found: ${allocation.itemName}`);
      if (allocation.category === "food") {
        const current = Math.max(0, Number(item.system?.quantity ?? 0));
        if (quantity > current) throw new Error(`${item.name} no longer has enough quantity.`);
        await item.update({ "system.quantity": current - quantity });
        continue;
      }
      if (/^water\s*\((?:1\s*)?pints?\)$/i.test(item.name) || /^(?:water-)?pint(?:-of-water)?$/i.test(item.system?.identifier ?? "")) {
        const wrapped = item.system?.quantity && typeof item.system.quantity === "object";
        const current = Math.max(0, Number(wrapped ? item.system.quantity.value : item.system?.quantity ?? 0));
        if (quantity > current) throw new Error(`${item.name} no longer has enough quantity.`);
        await item.update({ [wrapped ? "system.quantity.value" : "system.quantity"]: current - quantity });
        continue;
      }
      const flags = item.flags?.["morelord-journeys"] ?? {};
      const explicitUnits = Number(flags.waterUnits);
      if (Number.isFinite(explicitUnits)) {
        const remaining = Math.max(0, explicitUnits - quantity);
        await item.update({ "flags.morelord-journeys.waterUnits": remaining, "flags.morelord-journeys.waterState": remaining ? "full" : "empty" });
        continue;
      }
      const uses = item.system?.uses;
      const maximum = Number(uses?.max);
      const spent = Number(uses?.spent);
      if (Number.isFinite(maximum) && maximum > 0 && Number.isFinite(spent)) {
        await item.update({ "system.uses.spent": Math.min(maximum, spent + quantity) });
        continue;
      }
      const value = Number(uses?.value);
      if (Number.isFinite(value)) {
        await item.update({ "system.uses.value": Math.max(0, value - quantity) });
        continue;
      }
      await item.update({ "flags.morelord-journeys.waterUnits": 0, "flags.morelord-journeys.waterState": "empty" });
    }
    return plan;
  }
}

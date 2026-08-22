export class CampSupplyService {
  buildSleepPlan({ travelers = [], supplies = {}, assignments = {}, extremeWeather = false, coldWeather = false } = {}) {
    const totals = supplies?.totals ?? {};
    const usage = { tent: 0, bedroll: 0, blanket: 0 };
    const entries = travelers.map(traveler => {
      const selected = assignments[traveler.actorUuid] ?? {};
      if (selected.tent) usage.tent += 0.5;
      if (selected.bedroll) usage.bedroll += 1;
      if (selected.blanket) usage.blanket += 1;
      const modifiers = [];
      if (selected.tent) modifiers.push({ id: "tent", value: -5 });
      if (selected.bedroll) modifiers.push({ id: "bedroll", value: -2 });
      if (selected.blanket && coldWeather) modifiers.push({ id: "blanket", value: -1 });
      if (extremeWeather) modifiers.push({ id: "extremeWeather", value: 5 });
      return {
        actorUuid: traveler.actorUuid,
        actorName: traveler.name,
        equipment: { tent: Boolean(selected.tent), bedroll: Boolean(selected.bedroll), blanket: Boolean(selected.blanket) },
        dc: Math.max(0, 10 + modifiers.reduce((sum, modifier) => sum + modifier.value, 0)),
        modifiers
      };
    });
    const capacity = { tent: Number(totals.tent ?? 0), bedroll: Number(totals.bedroll ?? 0), blanket: Number(totals.blanket ?? 0) };
    const exceeded = Object.keys(usage).filter(key => usage[key] > capacity[key]);
    if (exceeded.length) throw new Error(`Not enough ${exceeded.join(", ")} in the supply manifest.`);
    return { entries, usage, capacity, extremeWeather, coldWeather, createdAt: Date.now() };
  }
}

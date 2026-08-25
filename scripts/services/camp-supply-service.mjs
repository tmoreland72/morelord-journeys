export class CampSupplyService {
  buildSleepPlan({ travelers = [], supplies = {}, assignments = {}, extremeWeather = false, coldWeather = false, peacefulNight = false } = {}) {
    const usage = { tent: 0, bedroll: 0, blanket: 0 };
    const entries = travelers.map(traveler => {
      const selected = assignments[traveler.actorUuid] ?? {};
      const owned = Object.fromEntries(["tent", "bedroll", "blanket"].map(category => [category,
        (supplies?.items ?? []).filter(item => item.category === category && item.sourceActorUuid === traveler.actorUuid).reduce((sum, item) => sum + Number(item.availableQuantity ?? 0), 0)
      ]));
      for (const category of ["tent", "bedroll", "blanket"]) {
        if (selected[category] && owned[category] < 1) throw new Error(`${traveler.name} does not own an available ${category}.`);
      }
      if (selected.tent) usage.tent += 1;
      if (selected.bedroll) usage.bedroll += 1;
      if (selected.blanket) usage.blanket += 1;
      const modifiers = [];
      if (selected.tent) modifiers.push({ id: "tent", value: -5 });
      if (selected.bedroll) modifiers.push({ id: "bedroll", value: -2 });
      if (selected.blanket && coldWeather) modifiers.push({ id: "blanket", value: -1 });
      if (extremeWeather) modifiers.push({ id: "extremeWeather", value: 5 });
      if (peacefulNight) modifiers.push({ id: "peacefulNight", value: -5 });
      return {
        actorUuid: traveler.actorUuid,
        actorName: traveler.name,
        equipment: { tent: Boolean(selected.tent), bedroll: Boolean(selected.bedroll), blanket: Boolean(selected.blanket) },
        dc: Math.max(0, 10 + modifiers.reduce((sum, modifier) => sum + modifier.value, 0)),
        baseDC: 10,
        modifiers,
        owned
      };
    });
    return { entries, usage, capacity: null, extremeWeather, coldWeather, peacefulNight, createdAt: Date.now() };
  }
}

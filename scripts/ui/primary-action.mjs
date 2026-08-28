const isAvailable = element => Boolean(element)
  && !element.disabled
  && !element.hidden
  && !element.closest("[hidden]")
  && element.getAttribute("aria-hidden") !== "true";

export function setPrimaryAction(root, selectors) {
  if (!root) return null;
  for (const button of root.querySelectorAll("button[data-tone='accent'][data-journey-primary-action]")) {
    delete button.dataset.tone;
    delete button.dataset.journeyPrimaryAction;
  }
  const primary = selectors
    .map(selector => root.querySelector(selector))
    .find(isAvailable) ?? null;
  if (primary) {
    primary.classList.add("ml-button");
    primary.dataset.tone = "accent";
    primary.dataset.journeyPrimaryAction = "true";
  }
  return primary;
}

export function primaryActionSelectors(context) {
  if (!context?.hasJourney) return ["[data-action='createJourney']"];
  if (context.isArrived) return ["[data-action='endJourney']"];
  if (context.canBeginDay) return ["[data-action='beginDay']"];
  if (context.isDayComplete) return ["[data-action='completeDay']"];
  const phase = context.journey?.phase;
  const day = context.journey?.currentDay ?? {};
  if (phase === "weather") {
    if (!day.extremeWeatherCheck) return ["[data-action='rollExtremeWeather']"];
    if (!day.generatedWeather) return ["[data-action='rollWeatherForecast']"];
    return ["[data-action='advancePhase']"];
  }
  if (phase === "encounters") return day.encounterCheck ? ["[data-action='advancePhase']"] : ["[data-action='rollEncounterChecks']"];
  if (phase === "discovery") {
    const result = day.roleRollResults?.discovery;
    if (!result) return ["[data-action='requestRoleRoll']"];
    if (result.outcome === "success" && !day.discoveryLead) return ["[data-action='rollDiscoveryLead']"];
    return ["[data-action='advancePhase']"];
  }
  if (phase === "navigation") return day.roleRollResults?.navigation ? ["[data-action='advancePhase']"] : ["[data-action='requestRoleRoll']"];
  if (phase === "camp") return day.nightEncounterCheck ? ["[data-action='advancePhase']"] : ["[data-action='rollNightEncounter']", "[data-action='advancePhase']"];
  if (phase === "sleep") {
    const complete = (day.campSleepResults?.length ?? 0) >= (context.journey?.travelers?.length ?? 0)
      && !(day.pendingSleepRolls?.length)
      && !(day.pendingPeacefulRestChoices?.length);
    return complete ? ["[data-action='advancePhase']"] : ["[data-action='rollCampSleep']"];
  }
  const selectors = {
    pace: ["[data-action='advancePhase']"],
    foraging: ["[data-action='requestForagingRolls']", "[data-action='consumeTravelSupplies']", "[data-action='advancePhase']"],
    pressOn: ["[data-action='requestForcedMarchRolls']", "[data-action='advancePhase']"],
  };
  return selectors[phase] ?? ["[data-action='advancePhase']"];
}

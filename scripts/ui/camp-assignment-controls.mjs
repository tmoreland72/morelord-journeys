import { normalizeCampAssignments, validateCampAssignments } from "../domain/camp-watch-rules.mjs";

export function readCampAssignments(element, journey) {
  const priorAssignments = normalizeCampAssignments(journey.travelers, journey.currentDay?.campWatches ?? []);
  const assignments = journey.travelers.map((traveler, index) => {
    const prior = priorAssignments[index];
    const action = element.querySelector(`[name='watchAction${index}']`)?.value ?? prior.action;
    const watchIndex = action === "Take a Watch" ? Number(element.querySelector(`[name='watchPeriod${index}']`)?.value ?? prior.watchIndex) : null;
    const additionalValue = element.querySelector(`[name='additionalWatchPeriod${index}']`)?.value ?? "";
    const watchIndexes = action === "Take a Watch"
      ? [watchIndex, ...(additionalValue === "" ? [] : [Number(additionalValue)])]
      : [];
    return { ...prior, index, actorUuid: traveler.actorUuid, actorName: traveler.name, action, watchIndex, watchIndexes };
  });
  return validateCampAssignments(assignments);
}

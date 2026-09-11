import { campPeriods, normalizeCampAssignments, validateCampAssignments } from "../domain/camp-watch-rules.mjs";

export function readCampAssignments(element, journey) {
  const priorAssignments = normalizeCampAssignments(journey.travelers, journey.currentDay?.campWatches ?? []);
  const assignments = journey.travelers.map((traveler, index) => {
    const prior = priorAssignments[index];
    if (element.querySelector(`[name='watchAction${index}-0']`)) {
      const periods = campPeriods(prior).map((period, periodIndex) => ({
        action: element.querySelector(`[name='watchAction${index}-${periodIndex}']`)?.value ?? period.action,
        watch: element.querySelector(`[name='campWatch${index}-${periodIndex}']`)?.checked ?? period.watch
      }));
      const watchIndexes = periods.flatMap((period, index) => period.watch ? [index] : []);
      return { ...prior, periods, action: periods.find(period => period.watch)?.action ?? periods.find(period => period.action !== "Slumber")?.action ?? "Slumber", additionalAction: "", watchIndexes, watchIndex: watchIndexes[0] ?? null };
    }
    const action = element.querySelector(`[name='watchAction${index}']`)?.value ?? prior.action;
    const periodValue = element.querySelector(`[name='watchPeriod${index}']`)?.value ?? String(prior.watchIndex ?? "");
    const watchIndex = periodValue === "" ? null : Number(periodValue);
    const additionalValue = element.querySelector(`[name='additionalWatchPeriod${index}']`)?.value ?? String(prior.watchIndexes?.[1] ?? "");
    const watchIndexes = [watchIndex, ...(additionalValue === "" ? [] : [Number(additionalValue)])].filter(value => value !== null);
    const additionalAction = action === "Take a Watch" ? element.querySelector(`[name='watchActionExtra${index}']`)?.value ?? prior.additionalAction ?? "" : "";
    return { ...prior, index, actorUuid: traveler.actorUuid, actorName: traveler.name, action, additionalAction, watchIndex, watchIndexes };
  });
  return validateCampAssignments(assignments);
}

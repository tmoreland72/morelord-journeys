export function createEncountersCallout({ action = "openMorelordEncounters" } = {}) {
  const callout = document.createElement("aside");
  callout.className = "ml-callout journey-action-callout journey-encounters-callout";
  callout.dataset.tone = "success";
  const copy = document.createElement("div");
  copy.innerHTML = "<strong>Optional combat encounter</strong><p>If this result becomes a combat encounter, Morelord Encounters can help the GM build and run it.</p>";
  const open = document.createElement("button");
  open.type = "button";
  open.dataset.action = action;
  open.className = "ml-button";
  open.innerHTML = '<i class="fa-solid fa-hydra"></i> Open Morelord Encounters';
  callout.append(copy, open);
  return callout;
}

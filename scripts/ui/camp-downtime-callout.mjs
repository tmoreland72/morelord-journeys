export function renderCampDowntimeCallout(continueButton, downtime) {
  if (!continueButton || !downtime?.available) return null;
  const panel = document.createElement("div");
  panel.className = "ml-callout journey-action-callout journey-downtime-integration";
  panel.dataset.tone = "success";
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Camp Downtime";
  const description = document.createElement("p");
  description.textContent = "While the party sets up camp, track a couple of hours of downtime.";
  copy.append(title, description);
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "openDowntime";
  button.classList.add("ml-button");
  button.textContent = "Open Downtime";
  panel.append(copy, button);
  continueButton.before(panel);
  return panel;
}

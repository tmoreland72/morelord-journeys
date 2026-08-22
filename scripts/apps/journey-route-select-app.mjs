import {
  DANGER_OPTIONS,
  DISCOVERY_OPTIONS,
  LENGTH_OPTIONS,
  NAVIGATION_OPTIONS,
  RESOURCE_OPTIONS
} from "../domain/route-options.mjs";
import { JourneyContextHelpApplication as BaseJourneyApplication } from "./journey-context-help-app.mjs";

function replaceWithSelect(element, name, options) {
  const field = element.querySelector(`[name='${name}']`);
  if (!field || field.tagName === "SELECT" && field.dataset.routeOptions === "true") return;
  const current = Number(field.value);
  const select = document.createElement("select");
  select.name = name;
  select.dataset.routeOptions = "true";
  for (const choice of options) {
    const option = document.createElement("option");
    option.value = String(choice.value);
    option.textContent = choice.label;
    option.selected = choice.value === current;
    select.append(option);
  }
  field.replaceWith(select);
}

export class JourneyRouteSelectApplication extends BaseJourneyApplication {
  async _onRender(context, options) {
    await super._onRender(context, options);
    replaceWithSelect(this.element, "lengthDays", LENGTH_OPTIONS);
    replaceWithSelect(this.element, "danger", DANGER_OPTIONS);
    replaceWithSelect(this.element, "discoveryDC", DISCOVERY_OPTIONS);
    replaceWithSelect(this.element, "resourcesDC", RESOURCE_OPTIONS);
    replaceWithSelect(this.element, "navigationDC", NAVIGATION_OPTIONS);
  }
}

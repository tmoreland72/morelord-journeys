import assert from "node:assert/strict";
import test from "node:test";
import { DowntimeOpenIntegration } from "../../scripts/integrations/downtime-open-integration.mjs";
import { renderCampDowntimeCallout } from "../../scripts/ui/camp-downtime-callout.mjs";

function element(tag) {
  const node = {
    tag,
    className: "",
    textContent: "",
    type: "",
    dataset: {},
    children: [],
    parent: null,
    classList: {
      add(token) {
        node.className = `${node.className} ${token}`.trim();
      }
    },
    append(...items) {
      for (const item of items) {
        item.parent = node;
        node.children.push(item);
      }
    },
    before(item) {
      item.parent = node.parent;
      const index = node.parent.children.indexOf(node);
      node.parent.children.splice(index, 0, item);
    },
    querySelector(selector) {
      const match = selector.match(/^\[data-action='([^']+)'\]$/);
      const action = match?.[1];
      const visit = current => {
        if (action && current.dataset?.action === action) return current;
        if (!action && current.tag === selector) return current;
        for (const child of current.children ?? []) {
          const found = visit(child);
          if (found) return found;
        }
        return null;
      };
      return visit(node);
    }
  };
  return node;
}

function continueButton() {
  const parent = element("section");
  parent.className = "journey-phase-card";
  const notes = element("button");
  notes.dataset.action = "advancePhase";
  notes.textContent = "Continue";
  notes.parent = parent;
  parent.children.push(notes);
  return { parent, notes };
}

test("Open Downtime is omitted unless Morelord Downtime can open its dashboard", () => {
  globalThis.document = { createElement: element };
  globalThis.game = { modules: new Map(), user: { isGM: true } };
  globalThis.MorelordDowntime = { open() {} };
  const integration = new DowntimeOpenIntegration();
  const hidden = continueButton();
  assert.equal(renderCampDowntimeCallout(hidden.notes, integration.snapshot()), null);
  assert.deepEqual(hidden.parent.children, [hidden.notes]);

  game.modules.set("morelord-downtime", { active: true, api: { open() {} } });
  const shown = continueButton();
  const panel = renderCampDowntimeCallout(shown.notes, integration.snapshot());
  const button = panel.querySelector("[data-action='openDowntime']");
  assert.equal(shown.parent.children[0], panel);
  assert.equal(shown.parent.children[1], shown.notes);
  assert.equal(panel.className, "ml-callout journey-action-callout journey-downtime-integration");
  assert.equal(panel.dataset.tone, "success");
  assert.equal(panel.children[0].children[0].textContent, "Camp Downtime");
  assert.match(panel.children[0].children[1].textContent, /couple of hours of downtime/);
  assert.equal(button.type, "button");
  assert.equal(button.className, "ml-button");
  assert.equal(button.textContent, "Open Downtime");

  delete globalThis.MorelordDowntime;
  delete globalThis.game;
  delete globalThis.document;
});

test("Camp Open Downtime launches the Downtime dashboard for the GM", async () => {
  let opened = 0;
  const errors = [];
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class { async _onRender() {} },
        HandlebarsApplicationMixin: cls => cls
      }
    }
  };
  globalThis.game = {
    modules: new Map([["morelord-downtime", {
      active: true,
      api: { async open() { opened += 1; } }
    }]]),
    user: { isGM: true }
  };
  globalThis.ui = { notifications: { error(message) { errors.push(message); } } };
  const { JourneyCampApplication } = await import("../../scripts/apps/journey-camp-app.mjs");

  await JourneyCampApplication.openDowntime({ preventDefault() {} });
  assert.equal(opened, 1);
  assert.deepEqual(errors, []);

  game.user.isGM = false;
  await JourneyCampApplication.openDowntime({ preventDefault() {} });
  assert.equal(opened, 1);
  assert.deepEqual(errors, ["Only the GM can open Morelord Downtime."]);

  delete globalThis.ui;
  delete globalThis.game;
  delete globalThis.foundry;
});

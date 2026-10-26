import test from "node:test";
import assert from "node:assert/strict";
import { addMorelordTool } from "../../scripts/foundry/add-morelord-tool.mjs";
import { journeysToolDefinition, openJourneysTool, registerJourneysSceneTool } from "../../scripts/foundry/journeys-scene-tool.mjs";

function restoreGlobals(prior) {
  for (const name of ["Hooks", "game", "foundry", "ui", "MorelordJourneys"]) {
    if (prior[name] === undefined) delete globalThis[name];
    else globalThis[name] = prior[name];
  }
}

function withGlobals(run) {
  const prior = {
    Hooks: globalThis.Hooks,
    game: globalThis.game,
    foundry: globalThis.foundry,
    ui: globalThis.ui,
    MorelordJourneys: globalThis.MorelordJourneys
  };
  try { return run(); }
  finally { restoreGlobals(prior); }
}

function installHooks() {
  const hooks = {
    setup: [],
    scene: [],
    once(event, callback) { if (event === "setup") this.setup.push(callback); },
    on(event, callback) { if (event === "getSceneControlButtons") this.scene.push(callback); },
    fireSetup() { for (const callback of this.setup) callback(); },
    fireScene(controls) { for (const callback of this.scene) callback(controls); }
  };
  globalThis.Hooks = hooks;
  return hooks;
}

function installCore({ present = true, version = "0.6.0", register = null, userIsGM = true } = {}) {
  const modules = new Map();
  if (present) {
    const api = {};
    if (register) api.tools = { register };
    modules.set("morelord-core", { version, api });
  }
  globalThis.game = {
    user: { isGM: userIsGM },
    modules: { get: id => modules.get(id) }
  };
  return modules;
}

const journeysDef = {
  id: "morelord-journeys",
  title: "Morelord Journeys",
  icon: "fa-solid fa-person-hiking",
  order: 10,
  visible: () => game.user.isGM,
  onClick: () => "opened"
};

test("core 0.6.0 registers the tool and does not add a Token button", () => {
  withGlobals(() => {
    const seen = [];
    installHooks();
    installCore({ version: "0.6.0", register: def => seen.push(def) });
    addMorelordTool(journeysDef);
    globalThis.Hooks.fireSetup();
    const controls = { tokens: { tools: { select: {} } } };
    globalThis.Hooks.fireScene(controls);
    assert.deepEqual(seen, [journeysDef]);
    assert.equal(globalThis.Hooks.scene.length, 0);
    assert.equal(controls.tokens.tools.morelordJourneys, undefined);
  });
});

test("core 0.10.0 still uses the tools registry", () => {
  withGlobals(() => {
    let called = false;
    installHooks();
    installCore({ version: "0.10.3", register: () => { called = true; } });
    addMorelordTool(journeysDef);
    globalThis.Hooks.fireSetup();
    assert.equal(called, true);
    assert.equal(globalThis.Hooks.scene.length, 0);
  });
});

test("core older than 0.6.0 keeps the Token palette button even if register exists", () => {
  withGlobals(() => {
    let registered = 0;
    installHooks();
    installCore({ version: "0.5.5", register: () => { registered += 1; }, userIsGM: true });
    let clickEvent = null;
    addMorelordTool({ ...journeysDef, onClick: event => { clickEvent = event; return "clicked"; } });
    globalThis.Hooks.fireSetup();
    const controls = { tokens: { tools: { select: {}, target: {} } } };
    globalThis.Hooks.fireScene(controls);
    const tool = controls.tokens.tools.morelordJourneys;
    assert.equal(registered, 0);
    assert.equal(tool.name, "morelordJourneys");
    assert.equal(tool.title, "Morelord Journeys");
    assert.equal(tool.icon, "fa-solid fa-person-hiking");
    assert.equal(tool.order, 2);
    assert.equal(tool.button, true);
    assert.equal(tool.visible, true);
    assert.equal(tool.onChange("event"), "clicked");
    assert.equal(clickEvent, "event");
    game.user.isGM = false;
    globalThis.Hooks.fireScene(controls);
    assert.equal(controls.tokens.tools.morelordJourneys.visible, false);
  });
});

test("missing core or a 0.6.0 core without register uses the Token button", () => {
  withGlobals(() => {
    installHooks();
    installCore({ present: false });
    addMorelordTool(journeysDef);
    globalThis.Hooks.fireSetup();
    const controls = { tokens: { tools: {} } };
    globalThis.Hooks.fireScene(controls);
    assert.equal(controls.tokens.tools.morelordJourneys.title, "Morelord Journeys");

    installHooks();
    installCore({ version: "0.6.0" });
    addMorelordTool(journeysDef);
    globalThis.Hooks.fireSetup();
    const again = { tokens: { tools: { ruler: {} } } };
    globalThis.Hooks.fireScene(again);
    assert.equal(again.tokens.tools.morelordJourneys.order, 1);
    assert.equal(again.tokens.tools.morelordJourneys.button, true);
  });
});

test("legacy registration ignores a controls payload without token tools", () => {
  withGlobals(() => {
    installHooks();
    installCore({ version: "0.3.15" });
    addMorelordTool({ id: "morelord-journeys", title: "Morelord Journeys", icon: "fa-solid fa-person-hiking", onClick() {} });
    globalThis.Hooks.fireSetup();
    assert.doesNotThrow(() => globalThis.Hooks.fireScene(null));
    assert.doesNotThrow(() => globalThis.Hooks.fireScene({ tokens: {} }));
  });
});

test("Foundry's version compare decides whether core provides tools", () => {
  withGlobals(() => {
    let called = false;
    installHooks();
    installCore({ version: "0.9.0", register: () => { called = true; } });
    globalThis.foundry = { utils: { isNewerVersion: (left, right) => left === "0.6.0" && right === "0.9.0" } };
    addMorelordTool(journeysDef);
    globalThis.Hooks.fireSetup();
    assert.equal(called, false);
    assert.equal(globalThis.Hooks.scene.length, 1);
  });
});

test("Journeys tool definition matches the Morelord Tools contract", () => {
  withGlobals(() => {
    installCore({ userIsGM: true });
    const def = journeysToolDefinition();
    assert.equal(def.id, "morelord-journeys");
    assert.equal(def.title, "Morelord Journeys");
    assert.equal(def.icon, "fa-solid fa-person-hiking");
    assert.equal(def.order, 10);
    assert.equal(def.visible(), true);
    assert.equal(def.onClick, openJourneysTool);
    game.user.isGM = false;
    assert.equal(def.visible(), false);
  });
});

test("opening the tool warns while Journeys is still initializing", () => {
  withGlobals(() => {
    const warnings = [];
    installCore();
    globalThis.ui = { notifications: { warn: message => { warnings.push(message); } } };
    globalThis.MorelordJourneys = {};
    game.modules.get = () => ({ api: { open() { throw new Error("module api should not be used"); } } });
    assert.equal(openJourneysTool(), undefined);
    assert.deepEqual(warnings, ["Morelord Journeys is still initializing."]);
  });
});

test("opening the tool calls the ready Journeys api", () => {
  withGlobals(() => {
    installCore();
    let opened = 0;
    globalThis.MorelordJourneys = { open: () => { opened += 1; return "window"; } };
    assert.equal(openJourneysTool(), "window");
    assert.equal(opened, 1);
    delete globalThis.MorelordJourneys;
    game.modules.set?.("morelord-journeys", { api: { open: () => "from-module" } });
    const modules = game.modules;
    const previousGet = modules.get;
    modules.get = id => id === "morelord-journeys" ? { api: { open: () => "from-module" } } : previousGet(id);
    assert.equal(openJourneysTool(), "from-module");
  });
});

test("registerJourneysSceneTool registers during setup on core 0.6.0", () => {
  withGlobals(() => {
    const seen = [];
    installHooks();
    installCore({ version: "0.6.0", register: def => seen.push(def) });
    registerJourneysSceneTool();
    globalThis.Hooks.fireSetup();
    assert.equal(seen.length, 1);
    assert.equal(seen[0].id, "morelord-journeys");
    assert.equal(seen[0].order, 10);
    assert.equal(seen[0].onClick, openJourneysTool);
    game.user.isGM = true;
    assert.equal(seen[0].visible(), true);
  });
});

const TOOLS_MINIMUM = "0.6.0";

export function addMorelordTool(def) {
  Hooks.once("setup", () => {
    const core = game.modules.get("morelord-core");
    const register = core?.api?.tools?.register;
    if (coreProvidesTools(core) && typeof register === "function") {
      register(def);
      return;
    }
    const key = sceneToolKey(def?.id);
    Hooks.on("getSceneControlButtons", controls => {
      const tokenTools = controls?.tokens?.tools;
      if (!tokenTools || !key) return;
      const visible = typeof def.visible === "function" ? def.visible() : def.visible;
      tokenTools[key] = {
        name: key,
        title: def.title,
        icon: def.icon,
        order: Object.keys(tokenTools).length,
        button: true,
        visible,
        onChange: event => def.onClick?.(event)
      };
    });
  });
}

function coreProvidesTools(core) {
  const version = core?.version;
  if (!version) return false;
  const isNewerVersion = globalThis.foundry?.utils?.isNewerVersion;
  if (typeof isNewerVersion === "function") return !isNewerVersion(TOOLS_MINIMUM, String(version));
  return compareVersions(String(version), TOOLS_MINIMUM) >= 0;
}

function sceneToolKey(id) {
  return String(id ?? "").replace(/-([a-zA-Z])/g, (_, letter) => letter.toUpperCase());
}

function compareVersions(left, right) {
  const parts = value => value.split(".").map(part => {
    const match = /^(\d+)/.exec(part.trim());
    return match ? Number(match[1]) : 0;
  });
  const a = parts(left);
  const b = parts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

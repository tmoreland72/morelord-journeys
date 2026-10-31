import { naturalD20 } from "../domain/d20-roll.mjs";
import { getMorelordSocketChannel } from "../core/morelord-core-socket-service.mjs";

const registeredChannels = new WeakSet();

/**
 * dnd5e 5.3 through 6.0.6 (installed worlds last recorded 6.0.3; current release 6.0.6):
 * `actor.rollSkill(config, dialog, message)` and `actor.rollSavingThrow(config, dialog, message)`
 * return `Promise<D20Roll[]|null>`. Leaving `dialog.configure` unset lets `D20Roll.applyKeybindings`
 * open the configuration dialog, or skip it when the system's keys are held on `config.event`
 * (defaults: Shift normal, Alt advantage, Control disadvantage).
 * Advantage booleans are passed only when true. `mergeObject` would otherwise replace an
 * effect-derived `advantage: true` with `false`. The system then cancels advantage against disadvantage.
 */
export function modifierEventFromKeyboard() {
  const down = globalThis.game?.keyboard?.downKeys;
  const has = (...codes) => Boolean(down?.has) && codes.some(code => down.has(code));
  return {
    altKey: has("AltLeft", "AltRight"),
    ctrlKey: has("ControlLeft", "ControlRight"),
    metaKey: has("MetaLeft", "MetaRight", "OsLeft", "OsRight"),
    shiftKey: has("ShiftLeft", "ShiftRight")
  };
}

export function systemCheckConfig({ skill = null, ability = null, dc = null, advantage = false, disadvantage = false } = {}) {
  const config = { event: modifierEventFromKeyboard() };
  if (skill) config.skill = skill;
  else if (ability) config.ability = ability;
  if (dc != null && Number.isFinite(Number(dc))) config.target = Number(dc);
  if (advantage) config.advantage = true;
  if (disadvantage) config.disadvantage = true;
  return config;
}

function listedRolls(native) {
  if (Array.isArray(native)) return native.filter(Boolean);
  if (Array.isArray(native?.rolls)) return native.rolls.filter(Boolean);
  if (native?.roll) return [native.roll];
  return native ? [native] : [];
}

/** Read the check total from the roll dnd5e returned. Advantage stays inside that roll. */
export function outcomeFromSystemRolls(native) {
  const roll = listedRolls(native).find(entry => Number.isFinite(Number(entry?.total)));
  if (!roll) return null;
  return {
    roll,
    total: Number(roll.total),
    natural: naturalD20(roll),
    messageId: roll.parent?.id ?? null
  };
}

export async function rollActorCheck(actor, { skill = null, ability = null, dc = null, advantage = false, disadvantage = false, message = {} } = {}) {
  const methodName = skill ? "rollSkill" : "rollSavingThrow";
  const method = actor?.[methodName];
  if (typeof method !== "function") {
    throw new Error(`${actor?.name ?? "This actor"} cannot make a D&D 5e ${skill ? "skill check" : "saving throw"}.`);
  }
  const native = await method.call(
    actor,
    systemCheckConfig({ skill, ability: skill ? null : (ability ?? "con"), dc, advantage, disadvantage }),
    {},
    {
      create: message.create !== false,
      ...(message.rollMode ? { rollMode: message.rollMode } : {}),
      data: message.data ?? {}
    }
  );
  if (!native || (Array.isArray(native) && native.length === 0)) return { cancelled: true };
  const outcome = outcomeFromSystemRolls(native);
  if (!outcome) throw new Error("The requested roll did not return a total.");
  return { cancelled: false, ...outcome };
}

export function registerSystemCheckRoll(channel) {
  if (!channel || registeredChannels.has(channel)) return;
  registeredChannels.add(channel);
  channel.on("journeys.systemCheck", async data => {
    const actor = await fromUuid(data?.actorUuid);
    if (!actor) return { cancelled: true, reason: "The assigned character could not be found." };
    if (actor.isOwner === false && !game.user?.isGM) return { cancelled: true, reason: "You cannot roll for this character." };
    try {
      const result = await rollActorCheck(actor, data);
      if (result.cancelled) return { cancelled: true };
      return { cancelled: false, total: result.total, natural: result.natural, messageId: result.messageId };
    } catch (error) {
      return { cancelled: true, reason: error.message };
    }
  });
}

export async function rollSystemCheck({ actor, senderUserId = null, ...options }) {
  if (!senderUserId || senderUserId === game.user?.id) return rollActorCheck(actor, options);
  const channel = getMorelordSocketChannel();
  registerSystemCheckRoll(channel);
  const response = await channel.executeAsUser("journeys.systemCheck", {
    actorUuid: actor.uuid,
    skill: options.skill ?? null,
    ability: options.ability ?? null,
    dc: options.dc ?? null,
    advantage: Boolean(options.advantage),
    disadvantage: Boolean(options.disadvantage),
    message: options.message ?? {}
  }, senderUserId);
  if (!response || response.cancelled || response.queued) {
    return {
      cancelled: true,
      reason: response?.reason || (response?.queued ? "The character's player is not ready to roll." : "The roll was cancelled.")
    };
  }
  if (!Number.isFinite(Number(response.total))) throw new Error("The requested roll did not return a total.");
  return { cancelled: false, total: Number(response.total), natural: response.natural ?? null, messageId: response.messageId ?? null, roll: null };
}

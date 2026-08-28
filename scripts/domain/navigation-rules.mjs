export function navigationOutcome({ total, dc, natural = null, automatic = null }) {
  if (automatic === true) return "success";
  if (automatic === false) return "lost";
  if (natural === 1) return "reversed";
  if (natural === 20) return "shortcut";
  return Number(total) >= Number(dc) ? "success" : "lost";
}

export function navigationOutcomeLabel(outcome) {
  return {
    success: "The party stays on course and applies today’s travel progress.",
    lost: "The party becomes lost and makes no travel progress today.",
    reversed: "The party becomes turned around, adding one full day to the remaining travel time.",
    shortcut: "The party finds a shortcut, reducing the remaining travel time by ⅓ day."
  }[outcome] ?? outcome;
}

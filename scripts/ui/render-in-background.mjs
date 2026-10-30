export function renderJourneyInBackground(application) {
  const ui = game.modules?.get?.("morelord-core")?.api?.ui ?? globalThis.MorelordCore?.ui;
  if (typeof ui?.renderInBackground === "function") return ui.renderInBackground(application);
  if (application?.rendered) return application.render({ force: false });
}

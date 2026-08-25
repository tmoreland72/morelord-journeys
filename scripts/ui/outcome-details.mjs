export function createOutcomeDetails({ title = "Outcome Details", cards = [] } = {}) {
  const details = document.createElement("details");
  details.className = "journey-outcome-details";
  const summary = document.createElement("summary");
  summary.textContent = title;
  const body = document.createElement("div");
  body.className = "journey-outcome-details-body";
  for (const card of cards) {
    const article = document.createElement("article");
    article.className = "journey-outcome-detail-card";
    if (card.title) {
      const heading = document.createElement("strong");
      heading.textContent = card.title;
      article.append(heading);
    }
    const list = document.createElement("dl");
    for (const row of card.rows ?? []) {
      if (row.value === undefined || row.value === null || row.value === "") continue;
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = row.label;
      const value = document.createElement("dd");
      value.textContent = String(row.value);
      wrapper.append(term, value);
      list.append(wrapper);
    }
    article.append(list);
    body.append(article);
  }
  details.append(summary, body);
  return details;
}

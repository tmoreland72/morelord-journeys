export function createOutcomeDetails({ title = "Outcome Details", cards = [] } = {}) {
  const details = document.createElement("details");
  details.className = "ml-details journey-outcome-details";
  const summary = document.createElement("summary");
  summary.textContent = title;
  const body = document.createElement("div");
  body.className = "ml-details__body";
  for (const card of cards) {
    const article = document.createElement("article");
    article.className = "ml-audit-card";
    if (card.title) {
      const heading = document.createElement("strong");
      heading.textContent = card.title;
      article.append(heading);
    }
    const list = document.createElement("dl");
    list.className = "ml-data-list";
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

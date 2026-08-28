export function synchronizeExclusiveRoleSelects(navigator, observer, changed = null) {
  if (!navigator || !observer) return;
  if (navigator.value && navigator.value === observer.value) {
    const selectToChange = changed === observer ? navigator : observer;
    const unavailable = selectToChange === observer ? navigator.value : observer.value;
    selectToChange.value = Array.from(selectToChange.options).find(option => option.value && option.value !== unavailable)?.value ?? "";
  }
  for (const option of navigator.options) option.disabled = Boolean(option.value && option.value === observer.value);
  for (const option of observer.options) option.disabled = Boolean(option.value && option.value === navigator.value);
}

export function bindExclusiveRoleSelects(navigator, observer) {
  if (!navigator || !observer) return;
  navigator.addEventListener("change", () => synchronizeExclusiveRoleSelects(navigator, observer, navigator));
  observer.addEventListener("change", () => synchronizeExclusiveRoleSelects(navigator, observer, observer));
  synchronizeExclusiveRoleSelects(navigator, observer);
}

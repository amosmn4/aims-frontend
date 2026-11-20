export function plainText(value: string | null | undefined) {
  let text = value ?? "";
  for (let index = 0; index < 3; index++) {
    const next =
      new DOMParser().parseFromString(
        text.replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, "\n"),
        "text/html",
      ).body.textContent ?? "";
    if (next === text) break;
    text = next;
  }
  return text.replace(/\u00a0/g, " ").trim();
}

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

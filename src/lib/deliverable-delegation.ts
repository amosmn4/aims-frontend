export function mergeDelegatedOutcomes(html: string, live: string) {
  if (!live.includes('data-status="delegated"')) return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  const source = new DOMParser().parseFromString(live, "text/html");
  const accepted = new Set(
    Array.from(source.querySelectorAll('li[data-status="delegated"]')).map((row) =>
      row.getAttribute("data-did"),
    ),
  );
  let changed = false;
  document.querySelectorAll('li[data-type="taskItem"]').forEach((row) => {
    if (
      !accepted.has(row.getAttribute("data-did")) ||
      row.getAttribute("data-status") === "delegated"
    )
      return;
    row.setAttribute("data-status", "delegated");
    row.setAttribute("data-checked", "false");
    row.removeAttribute("data-target-date");
    changed = true;
  });
  return changed ? document.body.innerHTML : html;
}

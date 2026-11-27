import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Config } from "dompurify";
const CONFIG: Config = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "strong",
    "em",
    "u",
    "s",
    "sub",
    "sup",
    "ul",
    "ol",
    "li",
    "a",
    "span",
    "table",
    "colgroup",
    "col",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "style", "class", "colspan", "rowspan", "colwidth"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
};
const ALLOWED_STYLES = new Set([
  "color",
  "background-color",
  "font-family",
  "font-size",
  "line-height",
  "text-align",
  "width",
  "min-width",
]);
type Purifier = {
  sanitize: (html: string, config: Config) => string;
};
let purifier: Promise<Purifier> | null = null;
function getPurifier(): Promise<Purifier> {
  purifier ??= import("dompurify").then(({ default: DOMPurify }) => {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.tagName === "A") {
        if (node.getAttribute("target") !== "_blank") node.removeAttribute("target");
        node.setAttribute("rel", "noopener noreferrer nofollow");
      }
      if (node.hasAttribute("class") && !(node.tagName === "P" && node.className === "drop-cap")) {
        node.removeAttribute("class");
      }
      if (node.hasAttribute("style")) {
        for (const prop of Array.from(node.style)) {
          const value = node.style.getPropertyValue(prop);
          if (!ALLOWED_STYLES.has(prop) || /url\(|expression|javascript:/i.test(value)) {
            node.style.removeProperty(prop);
          }
        }
        if (!node.getAttribute("style")) node.removeAttribute("style");
      }
    });
    return DOMPurify;
  });
  return purifier;
}
export function SafeHtml({
  html,
  className,
  taskContent = false,
  checkboxEditable = false,
  onContentReady,
}: {
  html: string | null | undefined;
  className?: string | undefined;
  taskContent?: boolean;
  checkboxEditable?: boolean;
  onContentReady?: ((container: HTMLDivElement) => void) | undefined;
}) {
  const [clean, setClean] = useState("");
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = clean;
    if (clean) onContentReady?.(container.current);
  }, [clean, onContentReady]);
  useEffect(() => {
    let active = true;
    if (!html) {
      setClean("");
      return;
    }
    getPurifier().then((p) => {
      if (!active) return;
      const sanitized = p.sanitize(
        html,
        taskContent
          ? {
              ...CONFIG,
              ALLOWED_TAGS: [...(CONFIG.ALLOWED_TAGS ?? []), "label", "div"],
              ALLOWED_ATTR: [
                ...(CONFIG.ALLOWED_ATTR ?? []),
                "data-type",
                "data-checked",
                "data-did",
                "data-status",
                "data-target-date",
                "data-carry-key",
              ],
            }
          : CONFIG,
      );
      if (!taskContent) {
        setClean(sanitized);
        return;
      }
      const document = new DOMParser().parseFromString(sanitized, "text/html");
      document.querySelectorAll('li[data-type="taskItem"]').forEach((item) => {
        Array.from(item.children)
          .filter((child) => child.tagName === "LABEL")
          .forEach((child) => child.remove());
        if (onContentReady) return;
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = item.getAttribute("data-checked") === "true";
        input.toggleAttribute("checked", input.checked);
        input.disabled = !checkboxEditable;
        input.setAttribute("aria-label", item.querySelector("p")?.textContent || "Deliverable");
        label.append(input);
        item.prepend(label);
      });
      setClean(document.body.innerHTML);
    });
    return () => {
      active = false;
    };
  }, [html, taskContent, checkboxEditable, onContentReady]);
  return <div ref={container} className={className} />;
}

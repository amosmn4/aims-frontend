import { useEffect, useState } from "react";
import type { Config } from "dompurify";

// Mirrors RICH_TEXT_OPTIONS in backend/src/common/sanitize.ts — second line of defence on display.
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

type Purifier = { sanitize: (html: string, config: Config) => string };
let purifier: Promise<Purifier> | null = null;

// Loaded lazily in the browser only: DOMPurify needs a real DOM.
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

/** Renders stored rich text safely. Never pass untrusted HTML to dangerouslySetInnerHTML directly. */
export function SafeHtml({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const [clean, setClean] = useState("");

  useEffect(() => {
    let active = true;
    if (!html) {
      setClean("");
      return;
    }
    getPurifier().then((p) => {
      if (active) setClean(p.sanitize(html, CONFIG));
    });
    return () => {
      active = false;
    };
  }, [html]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}

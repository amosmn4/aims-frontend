export const meta = (title: string, description: string) => [
  { title: `${title} · Amsol` },
  { name: "description", content: description },
  { property: "og:title", content: `${title} · Amsol` },
  { property: "og:description", content: description },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
];

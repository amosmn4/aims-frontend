export const plainAiText = (value: string) =>
  value.replace(/\*/g, "").replace(/^\s*#{1,6}\s+/gm, "");

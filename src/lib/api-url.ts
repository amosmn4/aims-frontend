export function opsApiUrl(configured?: string) {
  const base = (configured?.trim() || "/api/v1").replace(/\/+$/, "");
  return base.endsWith("/ops") ? base : `${base}/ops`;
}

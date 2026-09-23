// Fails the build when the output is incomplete, so a half-built app never reaches the server.
// A missing .output/public/assets is what makes every page load with 500s on the JS files.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const publicDir = join(root, ".output", "public");
const assetsDir = join(publicDir, "assets");
const serverEntry = join(root, ".output", "server", "index.mjs");
const problems = [];

if (!existsSync(serverEntry)) problems.push(".output/server/index.mjs is missing");
if (!existsSync(assetsDir)) {
  problems.push(".output/public/assets is missing");
} else {
  const files = readdirSync(assetsDir);
  const js = files.filter((f) => f.endsWith(".js"));
  const css = files.filter((f) => f.endsWith(".css"));
  const empty = js.filter((f) => statSync(join(assetsDir, f)).size === 0);
  if (js.length === 0) problems.push(".output/public/assets has no .js files");
  if (css.length === 0) problems.push(".output/public/assets has no .css files");
  if (empty.length) problems.push(`${empty.length} asset files are empty (out of disk space?)`);
  if (problems.length === 0) {
    console.log(
      `Build looks complete: ${js.length} JS and ${css.length} CSS files in .output/public/assets`,
    );
  }
}

if (problems.length) {
  console.error("\nBuild is incomplete — do not deploy this:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nCheck free disk and memory (df -h, free -m), then run the build again.\n");
  process.exit(1);
}

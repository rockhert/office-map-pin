// maps フォルダの画像を public/maps にコピーし、一覧(src/maps.json)を作る
import fs from "node:fs";
import path from "node:path";

const EXT = /\.(webp|png|jpe?g|gif|avif)$/i;
fs.rmSync("public/maps", { recursive: true, force: true });
fs.mkdirSync("public/maps", { recursive: true });
const files = fs
  .readdirSync("maps")
  .filter((f) => EXT.test(f))
  .sort((a, b) => a.localeCompare(b, "ja"));
for (const f of files) fs.copyFileSync(path.join("maps", f), path.join("public/maps", f));
const list = files.map((f) => ({ name: f.replace(EXT, ""), file: f }));
fs.writeFileSync("src/maps.json", JSON.stringify(list, null, 2));
console.log(`maps: ${list.length} files`);

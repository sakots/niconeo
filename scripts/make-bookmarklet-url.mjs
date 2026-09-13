import { readFile, writeFile } from "node:fs/promises";

const bundle = await readFile("dist/bookmarklet.js", "utf8");
await writeFile("dist/bookmarklet.url.txt", `javascript:${bundle}\n`);

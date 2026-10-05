import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (/\.m?js$/.test(path)) result.push(path);
  }
  return result;
}

let count = 0;
for (const directory of ["dist", "scripts", "tests"]) {
  for (const file of await files(directory)) {
    const result = spawnSync(process.execPath, ["--check", file], {
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
    count++;
  }
}
console.log(`Синтаксис проверен: ${count} файлов.`);

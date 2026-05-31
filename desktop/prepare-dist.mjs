import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "desktop-dist", "server");

async function copyIfExists(from, to) {
  try {
    await cp(from, to, { recursive: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await rm(path.join(root, "desktop-dist"), { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp(path.join(root, ".next", "standalone"), out, { recursive: true });
await mkdir(path.join(out, ".next"), { recursive: true });
await copyIfExists(path.join(root, ".next", "static"), path.join(out, ".next", "static"));
await copyIfExists(path.join(root, "public"), path.join(out, "public"));
await copyIfExists(path.join(root, "scripts", "bnbu-crawler"), path.join(out, "scripts", "bnbu-crawler"));
await copyIfExists(path.join(root, "course_imports"), path.join(out, "course_imports"));
await copyIfExists(path.join(root, "prisma"), path.join(out, "prisma"));

console.info(`Prepared TEAMAKING Desktop runtime at ${out}`);

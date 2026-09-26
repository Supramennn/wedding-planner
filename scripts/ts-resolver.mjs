/**
 * Resolver untuk `node --test`: menerjemahkan alias path tsconfig
 * (`@/lib/x` -> `<root>/lib/x`) dan menambahkan ekstensi yang tidak
 * ditulis di source.
 *
 * Dipakai bersama scripts/ts-alias.mjs. Tanpa dependensi tambahan.
 */
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = resolvePath(ROOT, specifier.slice(2));
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      resolvePath(base, "index.ts"),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate) && !existsSync(resolvePath(candidate, "package.json"))) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

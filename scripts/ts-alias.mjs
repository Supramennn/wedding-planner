/**
 * Entry point untuk `node --import` supaya unit test bisa mengimpor modul
 * app yang memakai alias path `@/`.
 *
 * Contoh menjalankan test (lihat package.json script `test`):
 *   node --experimental-strip-types --import ./scripts/ts-alias.mjs --test ...
 *
 * Tidak butuh paket test runner apa pun: memakai `node:test` bawaan Node.
 */
import { register } from "node:module";

register("./ts-resolver.mjs", import.meta.url);

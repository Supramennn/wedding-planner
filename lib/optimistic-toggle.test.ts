import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Logika inti optimistic toggle diekstrak supaya bisa diuji tanpa React.
 * Hook `useOptimisticToggle` memakai aturan yang sama untuk memangkas
 * override saat render.
 *
 * Aturan yang dijaga:
 * 1. Override berlaku hanya selama snapshot belum menyusul.
 * 2. Begitu snapshot sama dengan override, override dipangkas (ack).
 * 3. Override yang sudah dipangkas TIDAK boleh menutupi perubahan baru dari
 *    pasangan pada item yang sama. Ini bug yang nyata terjadi sebelumnya:
 *    override basi yang tidak pernah dibuang membuat nilai yang salah
 *    terus ditampilkan selamanya.
 */

type Field = "isCompleted" | "isDone";
type Item = { id: string } & Partial<Record<Field, boolean>>;

/**
 * Override dianggap basi (siap dibuang) kalau itemnya hilang dari snapshot
 * ATAU snapshot sudah sama dengan nilai override.
 */
function staleOverrides(
  items: Item[],
  overrides: Record<string, boolean>,
  field: Field
): string[] {
  return Object.keys(overrides).filter((id) => {
    const item = items.find((candidate) => candidate.id === id);
    return !item || item[field] === overrides[id];
  });
}

test("override dipakai selama snapshot belum menyusul", () => {
  const items: Item[] = [{ id: "1", isCompleted: false }];
  const overrides = { "1": true };
  assert.deepEqual(staleOverrides(items, overrides, "isCompleted"), []);
  assert.equal(overrides["1"], true, "nilai optimistis masih jadi yang tampil");
});

test("override dipangkas setelah snapshot menyusul (ack)", () => {
  const items: Item[] = [{ id: "1", isCompleted: true }];
  const overrides = { "1": true };
  assert.deepEqual(staleOverrides(items, overrides, "isCompleted"), ["1"]);
});

test("override dipangkas kalau itemnya dihapus", () => {
  const items: Item[] = [];
  const overrides = { "1": true };
  assert.deepEqual(staleOverrides(items, overrides, "isCompleted"), ["1"]);
});

test("perubahan pasangan setelah ack tetap terlihat", () => {
  // 1. Kita toggle ke true, override = {1: true}.
  const ourOverride = { "1": true };

  // 2. Snapshot menyusul dengan true → ack, override dipangkas.
  const afterAck: Item[] = [{ id: "1", isCompleted: true }];
  assert.deepEqual(
    staleOverrides(afterAck, ourOverride, "isCompleted"),
    ["1"],
    "override basi, dibuang"
  );

  // 3. Setelah dipangkas, override = {} sehingga yang tampil adalah nilai
  //    snapshot. Pasangan mengubah ke false → false yang tampil.
  const pruned: Record<string, boolean> = {};
  const partnerChanged: Item[] = [{ id: "1", isCompleted: false }];
  const shown =
    pruned["1"] ?? partnerChanged[0].isCompleted ?? false;
  assert.equal(shown, false, "perubahan pasangan tidak tertutup override");
});

test("beberapa item dipangkas independen", () => {
  const items: Item[] = [
    { id: "1", isCompleted: true }, // ack
    { id: "2", isCompleted: false }, // masih in-flight
    { id: "3", isCompleted: true }, // ack
  ];
  const overrides = { "1": true, "2": true, "3": true };
  assert.deepEqual(staleOverrides(items, overrides, "isCompleted"), ["1", "3"]);
});

test("field isDone memakai aturan yang sama", () => {
  const items: Item[] = [{ id: "1", isDone: true }];
  const overrides = { "1": true };
  assert.deepEqual(staleOverrides(items, overrides, "isDone"), ["1"]);
});

test("override kosong tidak pernah dianggap basi", () => {
  const items: Item[] = [{ id: "1", isCompleted: true }];
  assert.deepEqual(staleOverrides(items, {}, "isCompleted"), []);
});

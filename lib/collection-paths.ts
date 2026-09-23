/**
 * Path koleksi Firestore — satu tempat untuk seluruh app (FR: single source).
 * Skema: users/{uid}/checklist, users/{uid}/budget, users/{uid}/vendors
 */

export function userDocPath(uid: string): string[] {
  return ["users", uid];
}

export function checklistPath(uid: string): string[] {
  return ["users", uid, "checklist"];
}

export function budgetPath(uid: string): string[] {
  return ["users", uid, "budget"];
}

export function vendorsPath(uid: string): string[] {
  return ["users", uid, "vendors"];
}

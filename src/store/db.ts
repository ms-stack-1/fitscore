import { createStore, del, get, set, type UseStore } from "idb-keyval";
import type { AuditEvent } from "../core/audit";
import type { Candidate, CandidateResult, Role } from "../core/types";

/*
 * Local-first storage. Everything lives in this browser's IndexedDB and
 * nowhere else. One key per role for its candidates, results and audit events,
 * so deleting a role deletes every trace of its applicants.
 */

let store: UseStore | undefined;
const db = () => (store ??= createStore("fitscore", "workspace"));

const K = {
  roles: "roles",
  candidates: (roleId: string) => `candidates:${roleId}`,
  results: (roleId: string) => `results:${roleId}`,
  events: (roleId: string) => `events:${roleId}`,
};

export async function listRoles(): Promise<Role[]> {
  return ((await get<Role[]>(K.roles, db())) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getRole(id: string): Promise<Role | undefined> {
  return (await listRoles()).find((r) => r.id === id);
}

export async function saveRole(role: Role): Promise<void> {
  const roles = (await get<Role[]>(K.roles, db())) ?? [];
  const i = roles.findIndex((r) => r.id === role.id);
  if (i >= 0) roles[i] = role;
  else roles.push(role);
  await set(K.roles, roles, db());
}

export async function deleteRole(id: string): Promise<void> {
  const roles = ((await get<Role[]>(K.roles, db())) ?? []).filter((r) => r.id !== id);
  await set(K.roles, roles, db());
  await Promise.all([del(K.candidates(id), db()), del(K.results(id), db()), del(K.events(id), db())]);
}

export async function getCandidates(roleId: string): Promise<Candidate[]> {
  return (await get<Candidate[]>(K.candidates(roleId), db())) ?? [];
}

export async function saveCandidates(roleId: string, list: Candidate[]): Promise<void> {
  await set(K.candidates(roleId), list, db());
}

export async function getResults(roleId: string): Promise<CandidateResult[]> {
  return (await get<CandidateResult[]>(K.results(roleId), db())) ?? [];
}

export async function saveResults(roleId: string, list: CandidateResult[]): Promise<void> {
  await set(K.results(roleId), list, db());
}

export async function getEvents(roleId: string): Promise<AuditEvent[]> {
  return (await get<AuditEvent[]>(K.events(roleId), db())) ?? [];
}

export async function logEvent(roleId: string, e: Omit<AuditEvent, "ts">): Promise<void> {
  const list = await getEvents(roleId);
  list.push({ ...e, ts: Date.now() });
  await set(K.events(roleId), list, db());
}

export interface WorkspaceFile {
  app: "FitScore";
  kind: "workspace";
  schemaVersion: 1;
  exportedAt: string;
  roles: { role: Role; candidates: Candidate[]; results: CandidateResult[]; events: AuditEvent[] }[];
}

export async function exportWorkspace(): Promise<WorkspaceFile> {
  const roles = await listRoles();
  return {
    app: "FitScore",
    kind: "workspace",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    roles: await Promise.all(
      roles.map(async (role) => ({
        role,
        candidates: await getCandidates(role.id),
        results: await getResults(role.id),
        events: await getEvents(role.id),
      })),
    ),
  };
}

export async function importWorkspace(data: unknown): Promise<number> {
  const w = data as Partial<WorkspaceFile>;
  if (!w || w.app !== "FitScore" || w.kind !== "workspace" || !Array.isArray(w.roles)) throw new Error("This is not a FitScore workspace file.");
  for (const entry of w.roles) {
    if (!entry?.role?.id || !Array.isArray(entry.role.criteria)) throw new Error("The workspace file is damaged.");
    await saveRole(entry.role);
    await saveCandidates(entry.role.id, entry.candidates ?? []);
    await saveResults(entry.role.id, entry.results ?? []);
    await set(K.events(entry.role.id), entry.events ?? [], db());
  }
  return w.roles.length;
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "role";

import { useCallback, useEffect, useState } from "react";
import type { AuditEvent } from "../core/audit";
import type { Candidate, CandidateResult, Role } from "../core/types";
import { getCandidates, getEvents, getResults, getRole } from "../store/db";

export interface RoleData {
  role: Role;
  candidates: Candidate[];
  results: CandidateResult[];
  events: AuditEvent[];
}

export function useRoleData(roleId: string | undefined) {
  const [data, setData] = useState<RoleData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  const reload = useCallback(async () => {
    if (!roleId) return setState("missing");
    const role = await getRole(roleId);
    if (!role) return setState("missing");
    const [candidates, results, events] = await Promise.all([getCandidates(roleId), getResults(roleId), getEvents(roleId)]);
    setData({ role, candidates, results, events });
    setState("ready");
  }, [roleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, state, reload, setData };
}

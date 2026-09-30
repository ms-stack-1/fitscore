import { LocalJudge } from "../core/judges/local";
import type { EngineKind, Judge } from "../core/types";

/*
 * Engine selection. The rule engine is always available and is the fallback
 * for every other engine; AI engines register here as they are added.
 */

export interface EngineChoice {
  kind: EngineKind;
}

export function getJudge(choice: EngineChoice = { kind: "local" }): Judge {
  switch (choice.kind) {
    case "local":
    default:
      return new LocalJudge();
  }
}

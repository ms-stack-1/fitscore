export interface DemoProfile {
  id: string;
  name: string;
  headline: string;
  source: string;
  links: { portfolio: string; resume: string; email: string; linkedin: string; github: string };
  cv: string;
}

export const DEMOS = ["muhammad"] as const;
export type DemoId = (typeof DEMOS)[number];

export function isDemoId(s: string | null): s is DemoId {
  return !!s && (DEMOS as readonly string[]).includes(s);
}

export async function loadDemo(id: DemoId): Promise<DemoProfile> {
  const res = await fetch(`/demo/${id}.json`);
  if (!res.ok) throw new Error(`Demo profile unavailable (${res.status}).`);
  return (await res.json()) as DemoProfile;
}

export async function loadSampleJd(): Promise<string> {
  const res = await fetch("/demo/sample-jd.txt");
  return res.ok ? res.text() : "";
}

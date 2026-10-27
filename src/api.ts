export type Status = "new" | "saved" | "applied" | "interviewing" | "offer" | "rejected" | "dismissed"
export type Eligibility = "yes" | "maybe" | "no"

export interface Job {
  id: string
  source: string
  title: string
  company: string
  url: string
  location: string
  eligibility: Eligibility
  eligibility_reason: string
  tags: string[]
  salary: string | null
  posted_at: string | null
  description: string
  score: number
  matched: string[]
  status: Status
  notes: string
  first_seen: string
  status_changed_at: string | null
}

export interface SourceRun {
  source: string
  finished_at: string
  fetched: number
  kept: number
  error: string | null
}

export interface Stats {
  statuses: { key: Status; n: number }[]
  new_last_24h: number
  sources: SourceRun[]
  refreshing: boolean
  last_refresh: string | null
  refresh_hours: number
}

async function ok(r: Response) {
  if (!r.ok) throw new Error((await r.text()) || r.statusText)
  return r
}

export async function fetchJobs(params: { status: string; eligibility: string; q: string }): Promise<Job[]> {
  const qs = new URLSearchParams(params)
  return (await ok(await fetch(`/api/jobs?${qs}`))).json()
}

export async function fetchStats(): Promise<Stats> {
  return (await ok(await fetch("/api/stats"))).json()
}

export async function updateJob(id: string, patch: { status?: Status; notes?: string }) {
  await ok(await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }))
}

export async function refresh() {
  await ok(await fetch("/api/refresh", { method: "POST" }))
}

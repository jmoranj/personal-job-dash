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
  /** Who decided the eligibility: the keyword rules, or Claude for jobs the rules couldn't decide. */
  checked_by: "rules" | "claude"
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
  companies: { watched: number; with_matches: number; failing: number; candidates_left: number }
  discovering: boolean
  last_discovery: string | null
  last_discovery_report: { from_links: number; candidates_added: number; probed: number; found: number } | null
  /** Present when Claude checks are on. */
  ai: { backend: string; running: boolean; checked: number; pending: number; opened: number; closed: number } | null
}

export interface Company {
  ats: string
  slug: string
  name: string
  origin: string
  active: boolean
  added_at: string
  last_checked: string | null
  last_jobs: number
  last_kept: number
  error: string | null
}

export async function fetchCompanies(): Promise<Company[]> {
  return (await ok(await fetch("/api/companies"))).json()
}

export async function discover() {
  await ok(await fetch("/api/discover", { method: "POST" }))
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

export interface Draft {
  fit: { score: number; summary: string }
  company_notes: string
  highlights: { from_cv: string; why_it_matters: string }[]
  gaps: string[]
  cover_letter: string
  contact: { name: string | null; role: string | null; source_url: string | null; how_to_reach: string }
  outreach_message: string
  follow_up: string
  checks: string[]
  sources: string[]
}

export interface Application {
  job_id: string
  state: "preparing" | "ready" | "failed"
  draft: Draft | null
  error: string | null
  backend: string
  dollars: number
  updated_at: string
}

export async function fetchApplication(jobId: string): Promise<Application | null> {
  return (await ok(await fetch(`/api/jobs/${encodeURIComponent(jobId)}/application`))).json()
}

export async function prepareApplication(jobId: string) {
  await ok(await fetch(`/api/jobs/${encodeURIComponent(jobId)}/application`, { method: "POST" }))
}

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bookmark, Building2, Check, ExternalLink, Moon, RefreshCw, Search, Sun, X } from "lucide-react"
import { toast } from "sonner"

import { discover, fetchCompanies, fetchJobs, fetchStats, refresh, updateJob, type Company, type Job, type Stats, type Status } from "@/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/sonner"

const STATUSES: { key: Status; label: string }[] = [
  { key: "new", label: "New" },
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
  { key: "dismissed", label: "Dismissed" },
]

const ELIGIBILITY = [
  { key: "yes", label: "Open to Brazil" },
  { key: "default", label: "Open + unclear" },
  { key: "all", label: "Everything" },
]

function ago(iso: string | null) {
  if (!iso) return "—"
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000
  if (d < 1) return "today"
  if (d < 60) return `${Math.floor(d)}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function EligibilityBadge({ job }: { job: Job }) {
  const label = { yes: "Brazil OK", maybe: "Unclear", no: "Blocked" }[job.eligibility]
  const variant = job.eligibility === "yes" ? "default" : job.eligibility === "maybe" ? "outline" : "secondary"
  return <Badge variant={variant} title={job.eligibility_reason}>{label}</Badge>
}

export default function App() {
  const [status, setStatus] = useState<Status>("new")
  const [eligibility, setEligibility] = useState("default")
  const [q, setQ] = useState("")
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [companiesOpen, setCompaniesOpen] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  const load = useCallback(async () => {
    try {
      const [j, s] = await Promise.all([
        fetchJobs({ status, eligibility: eligibility === "default" ? "" : eligibility, q }),
        fetchStats(),
      ])
      setJobs(j)
      setStats(s)
      setError(null)
    } catch (e) {
      setError(`Can't reach the backend. Start it with "cargo run" in backend/. (${(e as Error).message})`)
    } finally {
      setLoading(false)
    }
  }, [status, eligibility, q])

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  // While a search or discovery runs on the server, poll until it finishes.
  const busy = stats?.refreshing || stats?.discovering
  useEffect(() => {
    if (!busy) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [busy, load])

  useEffect(() => {
    if (!companiesOpen) return
    fetchCompanies().then(setCompanies).catch((e) => toast(`Couldn't load companies: ${e.message}`))
  }, [companiesOpen, stats?.companies.watched])

  const counts = useMemo(() => Object.fromEntries((stats?.statuses ?? []).map((s) => [s.key, s.n])), [stats])
  const open = jobs.find((j) => j.id === openId) ?? null
  const failing = stats?.sources.filter((s) => s.error) ?? []

  async function move(job: Job, next: Status) {
    const prev = jobs
    setJobs((js) => js.filter((j) => j.id !== job.id || next === status))
    try {
      await updateJob(job.id, { status: next })
      toast(`${job.company}: moved to ${STATUSES.find((s) => s.key === next)?.label}`, {
        action: { label: "Undo", onClick: () => updateJob(job.id, { status: job.status }).then(load) },
      })
      if (openId === job.id && next !== status) setOpenId(null)
      load()
    } catch (e) {
      setJobs(prev)
      toast(`Couldn't update: ${(e as Error).message}`)
    }
  }

  async function saveNotes() {
    if (!open || notes === open.notes) return
    try {
      await updateJob(open.id, { notes })
      toast("Notes saved")
      load()
    } catch (e) {
      toast(`Couldn't save notes: ${(e as Error).message}`)
    }
  }

  async function runDiscover() {
    await discover()
    toast("Looking for new company career pages…")
    setStats((s) => (s ? { ...s, discovering: true } : s))
  }

  async function runRefresh() {
    await refresh()
    toast("Searching all sources…")
    setStats((s) => (s ? { ...s, refreshing: true } : s))
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Job Radar</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Remote software and AI roles you can take from Brazil.{" "}
            {stats && (
              <>
                {stats.new_last_24h} new in the last 24h · {stats.companies.watched} company career pages watched · last search {ago(stats.last_refresh ?? stats.sources[0]?.finished_at ?? null)} · runs every {stats.refresh_hours}h
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCompaniesOpen(true)}>
            <Building2 /> Companies
          </Button>
          <Button variant="outline" size="icon" onClick={() => setDark((d) => !d)} aria-label="Toggle dark mode">
            {dark ? <Sun /> : <Moon />}
          </Button>
          <Button onClick={runRefresh} disabled={stats?.refreshing}>
            <RefreshCw className={stats?.refreshing ? "animate-spin" : ""} />
            {stats?.refreshing ? "Searching…" : "Search now"}
          </Button>
        </div>
      </header>

      {error && <div className="border-foreground rounded-lg border p-4 text-sm">{error}</div>}

      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
        <div className="overflow-x-auto">
          <TabsList>
            {STATUSES.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>
                {s.label}
                <span className="text-muted-foreground ml-1 tabular-nums">{counts[s.key] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search title, company, stack…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-1">
          {ELIGIBILITY.map((e) => (
            <Button key={e.key} size="sm" variant={eligibility === e.key ? "default" : "ghost"} onClick={() => setEligibility(e.key)}>
              {e.label}
            </Button>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto text-sm tabular-nums">{jobs.length} jobs</span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-right">Match</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead className="hidden lg:table-cell">Source</TableHead>
              <TableHead className="w-16">Posted</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id} className="cursor-pointer" onClick={() => { setOpenId(job.id); setNotes(job.notes) }}>
                <TableCell className="text-right font-mono tabular-nums">{job.score}</TableCell>
                <TableCell className="max-w-0 w-full">
                  <div className="truncate font-medium">{job.title}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {job.company}
                    {job.salary && ` · ${job.salary}`}
                    {job.matched.length > 0 && ` · ${job.matched.slice(0, 4).join(", ")}`}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <EligibilityBadge job={job} />
                    <span className="text-muted-foreground max-w-48 truncate text-xs">{job.location || "Remote"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">{job.source}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{ago(job.posted_at ?? job.first_seen)}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    {job.status !== "saved" && (
                      <Button size="icon" variant="ghost" title="Save" aria-label={`Save ${job.title}`} onClick={() => move(job, "saved")}><Bookmark /></Button>
                    )}
                    {job.status !== "applied" && (
                      <Button size="icon" variant="ghost" title="Mark applied" aria-label={`Mark ${job.title} applied`} onClick={() => move(job, "applied")}><Check /></Button>
                    )}
                    {job.status !== "dismissed" && (
                      <Button size="icon" variant="ghost" title="Dismiss" aria-label={`Dismiss ${job.title}`} onClick={() => move(job, "dismissed")}><X /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-16 text-center">
                  {status === "new" ? "No new jobs match. Press Search now, or widen the filter." : "Nothing here yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {stats && stats.sources.length > 0 && (
        <footer className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {stats.sources.map((s) => (
            <span key={s.source} title={s.error ?? undefined} className={s.error ? "text-foreground line-through" : ""}>
              {s.source} <span className="tabular-nums">{s.kept}/{s.fetched}</span>
            </span>
          ))}
          {failing.length > 0 && <span className="text-foreground">{failing.length} source(s) failed; hover to see why</span>}
          <span>
            Company pages <span className="tabular-nums">{stats.companies.with_matches}/{stats.companies.watched}</span> with matches
            {stats.companies.failing > 0 && ` · ${stats.companies.failing} failing`}
          </span>
        </footer>
      )}

      <Sheet open={!!open} onOpenChange={(o) => { if (!o) { saveNotes(); setOpenId(null) } }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{open.title}</SheetTitle>
                <SheetDescription>
                  {open.company} · {open.location || "Remote"}{open.salary && ` · ${open.salary}`}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 px-4 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <EligibilityBadge job={open} />
                  <span className="text-muted-foreground text-sm">{open.eligibility_reason}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button render={<a href={open.url} target="_blank" rel="noreferrer" />}>
                    Open posting <ExternalLink />
                  </Button>
                  {STATUSES.filter((s) => s.key !== "new" && s.key !== open.status).map((s) => (
                    <Button key={s.key} variant="outline" size="sm" onClick={() => move(open, s.key)}>{s.label}</Button>
                  ))}
                </div>
                <div className="text-sm">
                  <div className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">Match {open.score}</div>
                  <div className="flex flex-wrap gap-1">
                    {open.matched.length ? open.matched.map((m) => <Badge key={m} variant="outline">{m}</Badge>) : <span className="text-muted-foreground">No profile skills found</span>}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">Notes</div>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Recruiter name, CV version used, interview questions…" />
                </div>
                <Separator />
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{open.description || "No description provided."}</p>
                <p className="text-muted-foreground text-xs">Found on {open.source}, first seen {ago(open.first_seen)}.</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={companiesOpen} onOpenChange={setCompaniesOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="text-xl">Company career pages</SheetTitle>
            <SheetDescription>
              Small and medium companies whose own job pages are watched on every search. Discovery finds them in job links,
              the remoteintech directory (worldwide and Americas hiring) and remote YC startups, then checks Greenhouse, Lever,
              Ashby and Workable for a page with open jobs. It runs daily.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={runDiscover} disabled={stats?.discovering}>
                <Search className={stats?.discovering ? "animate-pulse" : ""} />
                {stats?.discovering ? "Discovering…" : "Find more companies"}
              </Button>
              <span className="text-muted-foreground text-sm">
                {stats?.companies.watched ?? 0} watched · {stats?.companies.with_matches ?? 0} with matching roles
                {(stats?.companies.candidates_left ?? 0) > 0 && ` · ${stats?.companies.candidates_left} names still to check`}
              </span>
            </div>
            {stats?.last_discovery_report && (
              <p className="text-muted-foreground text-xs">
                Last run {ago(stats.last_discovery)}: {stats.last_discovery_report.from_links} from links,{" "}
                {stats.last_discovery_report.found} found by checking {stats.last_discovery_report.probed} names.
              </p>
            )}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Matches</TableHead>
                    <TableHead className="hidden sm:table-cell">Found via</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow key={`${c.ats}:${c.slug}`} className={c.active ? "" : "opacity-50"}>
                      <TableCell className="font-medium">{c.name || c.slug}</TableCell>
                      <TableCell className="text-muted-foreground text-xs" title={c.error ?? undefined}>
                        {c.ats}/{c.slug}
                        {c.error && " · failing"}
                        {!c.active && " · paused, no matches for 30 days"}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {c.last_checked ? `${c.last_kept}/${c.last_jobs}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">{c.origin}</TableCell>
                    </TableRow>
                  ))}
                  {companies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                        No company pages yet. Press Find more companies.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Toaster />
    </div>
  )
}

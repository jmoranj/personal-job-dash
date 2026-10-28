import { useCallback, useEffect, useState } from "react"
import { Copy, ExternalLink, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { fetchApplication, prepareApplication, type Application } from "@/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground mb-1 text-xs uppercase tracking-wide">{children}</div>
}

/** Text João will send, with a copy button. */
function Sendable({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label>{title}</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigator.clipboard.writeText(text).then(() => toast(`${title} copied`))}
        >
          <Copy /> Copy
        </Button>
      </div>
      <p className="bg-muted rounded-md p-3 text-sm leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  )
}

/** Drafts written by the prep agent: it reads the job and the CV, looks the company up, and writes. */
export function ApplicationPanel({ jobId }: { jobId: string }) {
  const [app, setApp] = useState<Application | null>(null)

  const load = useCallback(() => {
    fetchApplication(jobId).then(setApp).catch(() => setApp(null))
  }, [jobId])

  useEffect(load, [load])

  // The agent takes a minute or two; poll while it works.
  useEffect(() => {
    if (app?.state !== "preparing") return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [app?.state, load])

  async function start() {
    try {
      await prepareApplication(jobId)
      setApp((a) => ({ ...(a ?? { job_id: jobId, draft: null, error: null, backend: "", dollars: 0, updated_at: "" }), state: "preparing" }))
    } catch (e) {
      toast.error(`Couldn't start: ${(e as Error).message}`)
    }
  }

  if (!app || app.state === "failed") {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={start} className="self-start">
          <Sparkles /> Prepare application
        </Button>
        <p className="text-muted-foreground text-xs">
          {app?.state === "failed"
            ? `Last try failed: ${app.error}`
            : "Claude reads the posting and your CV, researches the company, and drafts a cover letter, a message to the hiring manager and a follow-up. You review and send."}
        </p>
      </div>
    )
  }

  if (app.state === "preparing" || !app.draft) {
    return <p className="text-muted-foreground animate-pulse text-sm">Researching the company and drafting… (about 1–2 minutes)</p>
  }

  const d = app.draft
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge>Fit {d.fit.score}/5</Badge>
          <span className="text-muted-foreground text-xs">via {app.backend} · ${app.dollars.toFixed(2)} at API price</span>
        </div>
        <Button variant="ghost" size="sm" onClick={start}>Redo</Button>
      </div>
      <p className="text-sm leading-relaxed">{d.fit.summary}</p>

      {d.checks.length > 0 && (
        <div className="border-foreground rounded-md border p-3">
          <Label>Check before sending</Label>
          <ul className="list-disc space-y-1 pl-4 text-sm">{d.checks.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}

      <div>
        <Label>Contact</Label>
        <p className="text-sm">
          {d.contact.name ? <span className="font-medium">{d.contact.name}</span> : "No named contact found"}
          {d.contact.role && ` · ${d.contact.role}`}
          {d.contact.source_url && (
            <a href={d.contact.source_url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center underline">
              source <ExternalLink className="size-3" />
            </a>
          )}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">{d.contact.how_to_reach}</p>
      </div>

      <Sendable title="Cover letter" text={d.cover_letter} />
      <Sendable title="Message to contact" text={d.outreach_message} />
      <Sendable title="Follow-up (5–7 days later)" text={d.follow_up} />

      <div>
        <Label>Your best matches</Label>
        <ul className="space-y-2 text-sm">
          {d.highlights.map((h) => (
            <li key={h.from_cv}>
              <div className="font-medium">{h.from_cv}</div>
              <div className="text-muted-foreground">{h.why_it_matters}</div>
            </li>
          ))}
        </ul>
      </div>

      {d.gaps.length > 0 && (
        <div>
          <Label>Gaps to be ready for</Label>
          <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">{d.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
      )}

      <div>
        <Label>About the company</Label>
        <p className="text-muted-foreground text-sm leading-relaxed">{d.company_notes}</p>
      </div>
    </div>
  )
}

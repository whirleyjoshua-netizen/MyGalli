import { Table2, Pencil, LayoutGrid, LineChart, Sparkles, Lightbulb } from 'lucide-react'

const FEATURES = [
  { icon: Table2, title: 'Define your schema', body: 'Choose from 10 field types to build a structured foundation.' },
  { icon: Pencil, title: 'Add and edit data', body: 'Use the spreadsheet grid to enter and update records — or import a CSV.' },
  { icon: LayoutGrid, title: 'View your data', body: 'Switch between Grid, Gallery, and Kanban views.' },
  { icon: LineChart, title: 'Track live metrics', body: 'Add KPIs to any page and keep your metrics up to date.' },
]

const TEMPLATES = ['Project Tracker', 'Content Calendar', 'CRM Pipeline', 'Event Planner', 'Inventory Tracker']

const TIPS = [
  'Use single-select fields to unlock Kanban grouping.',
  'Add KPIs to pages to surface the metrics that matter.',
  'You can add or change fields anytime as your data evolves.',
]

export function FeatureTour() {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">What you can do in Workspaces</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-surface p-4">
            <f.icon size={20} className="mb-2 text-galli" />
            <h3 className="mb-1 text-sm font-semibold">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function TemplatesComingSoon() {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles size={14} /> Start from a template
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TEMPLATES.map((t) => (
          <div key={t} className="rounded-xl border border-dashed border-border bg-muted/30 p-4 opacity-80" aria-disabled="true">
            <p className="mb-1 text-sm font-medium">{t}</p>
            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Coming soon</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function TipsRail() {
  return (
    <aside className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16} className="text-galli" /> Workspace tips</h3>
      <ul className="space-y-3">
        {TIPS.map((t) => <li key={t} className="text-xs text-muted-foreground">{t}</li>)}
      </ul>
    </aside>
  )
}

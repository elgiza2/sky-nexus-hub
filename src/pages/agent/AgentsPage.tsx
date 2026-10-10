/** English agent directory; setup happens in the original main-agent conversation. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  ArrowUpRight,
  Lock,
  RotateCw,
  Loader2,
  Sparkles,
  Search,
  CodeXml,
  Film,
  Image as ImageIcon,
  Palette,
  PenLine,
  ChartColumn,
  Mail,
  CalendarDays,
  Languages,
  GraduationCap,
  Megaphone,
  DollarSign,
  Map as MapIcon,
  Heart,
  Music2,
  Presentation,
  FileText,
  Brain,
  ShieldCheck,
  Users,
  Clock,
  Globe,
  BookOpen,
  Mic,
  Terminal,
  Star,
  Zap,
  Camera,
  Rocket,
  Briefcase,
  MessageSquare,
  WandSparkles,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { agentApi, type AgentInfo, type AgentColor } from "@/lib/agentsky/client";
import { useWorkspaceStore, workspace, loadWorkspace } from "@/lib/agentsky/store";
import { AgentShell } from "@/components/agent/AgentShell";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/common/SEOHead";
import { canUseAgent } from "@/lib/octoberOffer";

/* ── One distinct icon per agent, chosen from what the agent is for ────────── */
const RULES: [RegExp, LucideIcon][] = [
  [/\b(research|deep research|source|fact|investigat|scan|browse|web|search)\b/, Search],
  [/\b(code|coding|program|developer|dev|script|debug|api|software|engineer|frontend|backend)\b/, CodeXml],
  [/\b(video|film|clip|cinema|movie|animation|trailer|footage)\b/, Film],
  [/\b(image|photo|picture|illustrat|art|logo|poster|visual|render)\b/, ImageIcon],
  [/\b(design|brand|ui|color|style|aesthet)\b/, Palette],
  [/\b(write|writing|blog|article|copy|essay|content|story|novel|draft)\b/, PenLine],
  [/\b(data|analytic|metric|report|chart|dashboard|statistic|spreadsheet|sql)\b/, ChartColumn],
  [/\b(email|mail|inbox|newsletter|reply)\b/, Mail],
  [/\b(schedule|calendar|meeting|appointment|todo|task|agenda)\b/, CalendarDays],
  [/\b(translat|language|arabic|english|localiz)\b/, Languages],
  [/\b(learn|teach|study|tutor|explain|course|exam)\b/, GraduationCap],
  [/\b(market|marketing|ads|campaign|seo|growth|launch)\b/, Megaphone],
  [/\b(money|budget|invoice|price|cost|revenue|sales|finance)\b/, DollarSign],
  [/\b(travel|trip|flight|hotel|itinerary|destination)\b/, MapIcon],
  [/\b(health|fitness|workout|diet|meal|recipe)\b/, Heart],
  [/\b(music|song|lyrics|audio|podcast|voice)\b/, Music2],
  [/\b(slides|presentation|deck|pitch)\b/, Presentation],
  [/\b(doc|document|pdf|docx|note|summary|summar)\b/, FileText],
  [/\b(memory|remember|personali|profile)\b/, Brain],
  [/\b(security|privacy|protect|guard)\b/, ShieldCheck],
  [/\b(team|people|collab|community)\b/, Users],
  [/\b(time|clock|deadline)\b/, Clock],
  [/\b(world|country|global|international)\b/, Globe],
  [/\b(book|read|literature|reading)\b/, BookOpen],
  [/\b(audio|speak|speech|record)\b/, Mic],
  [/\b(terminal|shell|linux|server|deploy)\b/, Terminal],
  [/\b(best|top|review|rating)\b/, Star],
  [/\b(automat|quick|fast|speed)\b/, Zap],
  [/\b(science|experiment|lab|test)\b/, FlaskConical],
  [/\b(business|startup|strategy|company|plan)\b/, Briefcase],
  [/\b(chat|talk|conversation|dialog)\b/, MessageSquare],
  [/\b(magic|generate|ai|create)\b/, WandSparkles],
];

const CYCLE: LucideIcon[] = [
  Sparkles, Search, CodeXml, Film, ImageIcon, Palette, PenLine, ChartColumn, Mail,
  CalendarDays, Languages, GraduationCap, Megaphone, DollarSign, MapIcon, Heart,
  Music2, Presentation, FileText, Brain, ShieldCheck, Users, Clock, Globe, BookOpen,
  Mic, Terminal, Star, Zap, Camera, Rocket, Briefcase, MessageSquare, WandSparkles,
];

function pickIcon(a: AgentInfo): LucideIcon {
  if (a.isDefault) return Sparkles;
  if (a.mediaOnly) return Camera;
  const text = `${a.name} ${a.description} ${a.prompt}`.toLowerCase();
  for (const [re, icon] of RULES) if (re.test(text)) return icon;
  let h = 0;
  for (let i = 0; i < a.id.length; i++) h = (h * 31 + a.id.charCodeAt(i)) >>> 0;
  return CYCLE[h % CYCLE.length];
}

/* ── The agent's own colour drives the icon tile tint ─────────────────────── */
const TINT: Record<AgentColor, string> = {
  aurora: "var(--settings-violet)",
  ocean: "var(--settings-blue)",
  ember: "var(--settings-red)",
  mint: "var(--settings-green)",
  sun: "oklch(.6 .15 87)",
  rose: "var(--settings-pink)",
  mono: "var(--settings-muted)",
};

const AGENT_CSS = `
  .agx-tile {
    width: 38px; height: 38px; flex-shrink: 0;
    display: grid; place-items: center;
    border-radius: 12px;
    color: var(--agx);
    background: color-mix(in oklch, var(--agx) 14%, var(--settings-surface));
    border: 1px solid color-mix(in oklch, var(--agx) 26%, transparent);
  }
  .agx-tile svg { width: 19px; height: 19px; stroke-width: 1.7; }
  .agx-chip {
    flex-shrink: 0; white-space: nowrap;
    font-size: 11px; font-weight: 650; letter-spacing: .02em;
    padding: 2px 8px; border-radius: 999px;
    color: var(--settings-muted);
    background: var(--settings-line);
  }
  .agx-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .agx-card { animation: agx-in .45s cubic-bezier(.22,1,.36,1) both; }
  @keyframes agx-in { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }
  @media(prefers-reduced-motion:reduce) { .agx-card { animation: none; } }
  @media(max-width:520px) { .agx-open-label { display: none; } }
`;

export function AgentsPage() {
  const nav = useNavigate();
  const { agents, ready, error, sessions, tier } = useWorkspaceStore();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [now] = useState(Date.now());
  const setup = () => nav("/chat", { state: { agentCreation: true } });
  const filtered = agents;
  const personal = filtered.filter(a => !a.isTemplate);
  const catalogue = filtered.filter(a => a.isTemplate && !a.mediaOnly);
  const media = filtered.filter(a => a.mediaOnly);

  const item = (a: AgentInfo) => {
    const active = sessions.filter(s => s.agentId === a.id && s.status === "running").length;
    const locked = !a.isDefault && !canUseAgent(tier, !!a.mediaOnly, now);
    const Icon = pickIcon(a);
    return (
      <li key={a.id} className="gx-row gx-row-tap" style={{ ["--agx" as any]: TINT[a.color] }}>
        <span className="agx-tile"><Icon /></span>
        <span className="gx-row-body">
          <span className="gx-row-label flex min-w-0 items-center gap-2">
            <span className="agx-name">{a.name}</span>
            {a.isDefault && <span className="agx-chip">Main</span>}
            {active > 0 && <span className="agx-chip">{active} live</span>}
          </span>
          <span className="gx-row-hint">
            {a.mediaOnly ? "Image and video creation" : a.description || (a.isDefault ? "Your everyday partner" : "Personal AI agent")}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {!a.isDefault && !a.isTemplate && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${a.name}`}
              title={`Delete ${a.name}`}
              disabled={deleting === a.id}
              onClick={async () => {
                if (!confirm(`Delete ${a.name}? Your conversations will not be deleted.`)) return;
                setDeleting(a.id);
                setDeleteError(null);
                try {
                  await agentApi.deleteAgent(a.id);
                  workspace.removeAgent(a.id);
                } catch (e) {
                  setDeleteError(e instanceof Error ? e.message : "Could not delete agent");
                } finally {
                  setDeleting(null);
                }
              }}
            >
              <Trash2 size={16} />
            </Button>
          )}
          <Button
            variant="neutral"
            size="sm"
            onClick={() => nav(locked ? "/pricing" : `/chat?agent=${encodeURIComponent(a.id)}`)}
          >
            {locked ? <><Lock size={14} />Pro</> : <><span className="agx-open-label">Open chat</span><ArrowUpRight size={14} /></>}
          </Button>
        </span>
      </li>
    );
  };

  return (
    <div data-no-translate dir="ltr" className="megsy-agents">
      <style>{AGENT_CSS}</style>
      <AgentShell
        lang="en"
        title="Agents"
        actions={
          <Button variant="neutral" size="sm" onClick={setup}>
            <Plus size={16} />
            Add agent
          </Button>
        }
      >
        <SEOHead locale="en" path="/agents" title="Your agents" description="Your personal Megsy AI agents, specialist agents and conversations." />
        <div
          className="flex-1 overflow-y-auto px-5 py-8 md:px-12 md:py-10"
          style={{ background: "var(--settings-backdrop)", backgroundAttachment: "fixed" }}
        >
          <div className="mx-auto w-full max-w-3xl">
            <h1 className="gx-title">Agents</h1>
            <p className="gx-sub">Personal agents, specialists and media makers — each with its own icon and chat.</p>

            {(error || deleteError) && (
              <div className="mt-6 flex items-center gap-3" role="alert">
                <p className="text-sm text-destructive">{error || deleteError}</p>
                <Button variant="ghost" size="icon-sm" aria-label="Retry loading agents" onClick={() => void loadWorkspace(true)}>
                  <RotateCw size={16} />
                </Button>
              </div>
            )}

            {!ready && (
              <div className="flex items-center gap-3 py-16" role="status">
                <Loader2 size={18} className="animate-spin" style={{ color: "var(--settings-muted)" }} />
                <span className="text-sm" style={{ color: "var(--settings-muted)" }}>Loading…</span>
              </div>
            )}

            {[{ title: "Yours", list: personal }, { title: "Specialists", list: catalogue }, { title: "Images & video", list: media }].map(
              group =>
                group.list.length ? (
                  <section key={group.title} className="mt-8">
                    <h2 className="gx-section-title">{group.title}</h2>
                    <ul className="gx-card agx-card">{group.list.map(item)}</ul>
                  </section>
                ) : null,
            )}

            {ready && !filtered.length && !error && (
              <div className="gx-card gx-empty mt-8">
                <p>Your next agent starts with a conversation.</p>
                <Button variant="neutral" className="mt-4" onClick={setup}>
                  <Plus size={16} />
                  Add agent
                </Button>
              </div>
            )}
          </div>
        </div>
      </AgentShell>
    </div>
  );
}

export function AgentNewPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/chat", { replace: true, state: { agentCreation: true } }); }, [navigate]);
  return null;
}

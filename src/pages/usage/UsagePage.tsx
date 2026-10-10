/**
 * @doc Billing — the single statement page. Glass sheet: back + help, big title,
 * thin icon rows (renewal, amount, auto pay), past statements, and a bill sheet
 * that opens with the real statement data.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Wallet,
  RefreshCcw,
  FileText,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunction";
import { claimDailyCredits, fetchCreditOverview, type CreditOverview } from "@/lib/creditsSystem";
import { translateExactText, useUserLang, type AuthLang } from "@/lib/authI18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Sub = {
  id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  amount_cents: number | null;
  currency: string | null;
  created_at: string;
};

const locale = (lang: AuthLang) => (lang === "ar-eg" ? "ar-EG" : "en-US");

const fmtDate = (s: string | null | undefined, lang: AuthLang) =>
  s
    ? new Date(s).toLocaleDateString(locale(lang), {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const money = (cents: number | null, currency: string | null) =>
  cents ? `${(cents / 100).toFixed(0)} ${currency || "EGP"}` : "—";

/* ── One statement row: icon tile, label over value, optional chevron ── */
const Row = ({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  onClick,
  chevron = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone?: "neutral" | "violet" | "blue" | "green" | "yellow";
  onClick?: () => void;
  chevron?: boolean;
}) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`bill-row bill-tone-${tone} ${onClick ? "bill-row-tap" : ""}`}
    >
      <span className="bill-tile">
        <Icon className="bill-tile-icon" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        <span className="bill-value mt-0.5 block">{value}</span>
      </span>
      {chevron && <ChevronRight className="bill-chev rtl:rotate-180" strokeWidth={1.9} />}
    </Tag>
  );
};

/* ── Label / value line inside the bill sheet ── */
const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="bill-fact">
    <span className="bill-fact-label">{label}</span>
    <span className="bill-fact-value">{value}</span>
  </div>
);

const UsagePage = () => {
  const navigate = useNavigate();
  const lang = useUserLang();
  const copy = (s: string) => translateExactText(s, lang);
  const ar = lang === "ar-eg";

  const [overview, setOverview] = useState<CreditOverview | null>(null);
  const [credits, setCredits] = useState(0);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [openBill, setOpenBill] = useState<Sub | "current" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      /* __TEMP_DEMO__ */
      if (new URLSearchParams(window.location.search).has("demo")) {
        setCredits(1240);
        setOverview({
          credits: 1240, plan: "pro", dailyAllowance: 100, claimedToday: true, grantedToday: 100,
          nextRefresh: new Date(Date.now() + 5 * 3600e3).toISOString(), spentToday: 38, tasksToday: 4,
          spentThisMonth: 620, freeToday: {}, dailyCredits: 100, bonusCredits: 40, planCredits: 1000,
          purchasedCredits: 100,
        } as CreditOverview);
        setSubs([
          { id: "s1", plan: "pro", status: "active", current_period_end: new Date(Date.now() + 18 * 864e5).toISOString(), amount_cents: 4000, currency: "USD", created_at: new Date("2026-09-22T10:00:00Z").toISOString() },
          { id: "s2", plan: "pro", status: "cancelled", current_period_end: new Date("2026-09-22T10:00:00Z").toISOString(), amount_cents: 4000, currency: "USD", created_at: new Date("2026-08-22T10:00:00Z").toISOString() },
        ]);
        setLoading(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!dead) {
          setSignedOut(true);
          setLoading(false);
        }
        return;
      }
      await claimDailyCredits();
      const [ov, profile, subRows] = await Promise.all([
        fetchCreditOverview().catch(() => null),
        supabase.from("profiles").select("credits").eq("id", user.id).single(),
        supabase
          .from("subscriptions")
          .select("id, plan, status, current_period_end, amount_cents, currency, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
      if (dead) return;
      if (ov) {
        setOverview(ov);
        setCredits(Number(ov.credits) || 0);
      } else if (profile.data) {
        setCredits(Number(profile.data.credits) || 0);
      }
      if (subRows.data) setSubs(subRows.data as Sub[]);
      setLoading(false);
    })();
    return () => {
      dead = true;
    };
  }, []);

  const sub = subs[0] ?? null;
  const isActive =
    !cancelled && (sub?.status === "active" || sub?.status === "trialing");
  const amountLabel = sub?.amount_cents
    ? money(sub.amount_cents, sub.currency)
    : `${credits.toLocaleString(locale(lang))} MC`;

  const refreshIn = useMemo(() => {
    if (!overview?.nextRefresh) return "—";
    const mins = Math.max(
      0,
      Math.round((new Date(overview.nextRefresh).getTime() - Date.now()) / 60000),
    );
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }, [overview?.nextRefresh]);

  const cancelSubscription = async () => {
    setCancelling(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error(copy("Sign in again to continue."));
      const { error } = await invokeFunction("kashier-checkout", {
        body: { kind: "cancel-subscription" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setCancelled(true);
      setConfirmCancel(false);
      toast.success(
        copy("Subscription cancelled. Your plan stays active until the end of the billing period."),
      );
    } catch (e: any) {
      toast.error(e?.message || copy("Could not cancel right now. Please contact support."));
    } finally {
      setCancelling(false);
    }
  };

  const billFacts = useMemo(() => {
    const bal = `${credits.toLocaleString(locale(lang))} MC`;
    if (openBill === "current" || !openBill) {
      return [
        { label: copy("Plan"), value: isActive && sub ? sub.plan : copy("Free") },
        { label: copy("Amount"), value: amountLabel },
        { label: copy("Credit balance"), value: bal },
        {
          label: copy("Used today"),
          value: overview ? `${Math.round(overview.spentToday)} / ${Math.round(overview.dailyAllowance)}` : "—",
        },
        {
          label: copy("Used this month"),
          value: overview ? `${Math.round(overview.spentThisMonth)} MC` : "—",
        },
        { label: copy("Daily refresh in"), value: refreshIn },
      ];
    }
    return [
      { label: copy("Plan"), value: openBill.plan },
      {
        label: copy("Status"),
        value:
          openBill.status === "active" || openBill.status === "trialing"
            ? copy("Active")
            : openBill.status === "cancelled"
              ? copy("Cancelled")
              : openBill.status || "—",
      },
      { label: copy("Amount"), value: money(openBill.amount_cents, openBill.currency) },
      { label: copy("Statement date"), value: fmtDate(openBill.created_at, lang) },
      {
        label: copy("Billing period ends"),
        value: fmtDate(openBill.current_period_end, lang),
      },
      { label: copy("Credit balance"), value: bal },
    ];
  }, [openBill, credits, lang, isActive, sub, amountLabel, overview, refreshIn, copy]);

  return (
    <div className="bill-root" dir={ar ? "rtl" : "ltr"}>
      <style>{billCss}</style>

      <header className="bill-top">
        <button type="button" aria-label={copy("Back")} onClick={() => navigate("/settings")} className="bill-hbtn">
          <ChevronLeft className="bill-hicon rtl:rotate-180" strokeWidth={2} />
        </button>
        <button type="button" aria-label={copy("Help")} onClick={() => navigate("/support")} className="bill-hbtn">
          <HelpCircle className="bill-hicon" strokeWidth={1.8} />
        </button>
      </header>

      <main className="bill-main">
        <h1 className="bill-title">{copy("Billing")}</h1>

        {loading ? (
          <div className="bill-card bill-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{copy("Loading…")}</span>
          </div>
        ) : signedOut ? (
          <div className="bill-card bill-empty">
            <p>{copy("Sign in to see your credits")}</p>
            <button
              type="button"
              className="bill-pill"
              onClick={() => navigate("/auth?redirect=/usage")}
            >
              {copy("Sign in")}
            </button>
          </div>
        ) : (
          <>
            <section className="bill-card">
              <Row
                icon={CalendarDays}
                tone="blue"
                label={copy("Next renewal")}
                value={
                  isActive && sub?.current_period_end
                    ? fmtDate(sub.current_period_end, lang)
                    : copy("No active subscription")
                }
              />
              <Row
                icon={Wallet}
                tone="violet"
                label={copy("Amount")}
                value={amountLabel}
                onClick={() => setOpenBill(sub ?? "current")}
                chevron
              />
              <Row
                icon={RefreshCcw}
                tone={isActive ? "green" : "neutral"}
                label={copy("Auto pay")}
                value={isActive ? copy("On") : copy("Off")}
                onClick={() => (isActive ? setConfirmCancel(true) : navigate("/pricing"))}
                chevron
              />
            </section>

            <h2 className="bill-sec">{copy("Past statements")}</h2>
            <section className="bill-card">
              {subs.length ? (
                subs.map((s) => (
                  <Row
                    key={s.id}
                    icon={FileText}
                    label={fmtDate(s.created_at, lang)}
                    value={s.amount_cents ? money(s.amount_cents, s.currency) : copy("Free")}
                    onClick={() => setOpenBill(s)}
                    chevron
                  />
                ))
              ) : (
                <p className="bill-none">{copy("No statements yet")}</p>
              )}
            </section>

            <div className="bill-foot">
              <button type="button" className="bill-pill bill-pill-wide" onClick={() => setOpenBill(sub ?? "current")}>
                {copy("View bill")}
              </button>
            </div>
          </>
        )}
      </main>

      {/* ── Bill sheet ── */}
      {openBill && (
        <div className="bill-scrim" onClick={() => setOpenBill(null)}>
          <div className="bill-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bill-sheet-bar" />
            <div className="bill-sheet-head">
              <h3 className="bill-sheet-title">
                {openBill === "current" || !openBill
                  ? copy("Current bill")
                  : fmtDate(openBill.created_at, lang)}
              </h3>
              <button
                type="button"
                aria-label={copy("Close")}
                onClick={() => setOpenBill(null)}
                className="bill-hbtn bill-hbtn-sm"
              >
                <X className="bill-hicon" strokeWidth={2} />
              </button>
            </div>

            <div className="bill-sheet-body">
              {billFacts.map((f) => (
                <Fact key={f.label} label={f.label} value={f.value} />
              ))}
            </div>

            <button type="button" className="bill-pill bill-pill-wide" onClick={() => navigate("/pricing")}>
              {copy("Buy credits")}
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent dir={ar ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy("Cancel subscription?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy(
                "You'll keep your paid plan until the end of the current period, then switch to the free plan. Purchased credits are kept.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>{copy("Keep plan")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelSubscription();
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                copy("Cancel subscription")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsagePage;

const billCss = `
.bill-root {
  min-height: 100dvh;
  background: var(--settings-backdrop);
  background-attachment: fixed;
  color: var(--settings-ink);
  font-family: -apple-system, "SF Pro Display", Inter, sans-serif;
  display: flex; flex-direction: column;
}
.bill-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: max(14px, env(safe-area-inset-top)) 16px 6px;
}
.bill-hbtn {
  width: 44px; height: 44px; padding: 0; display: inline-grid; place-items: center;
  border: 0; border-radius: 50%; cursor: pointer;
  background: var(--settings-surface); color: var(--settings-ink);
  backdrop-filter: var(--settings-frost); box-shadow: var(--settings-shadow);
  transition: transform .2s cubic-bezier(.22,1,.36,1), background .2s;
}
.bill-hbtn:active { transform: scale(.92); background: var(--settings-line); }
.bill-hbtn-sm { width: 36px; height: 36px; }
.bill-hicon { width: 22px; height: 22px; }
.bill-main { width: 100%; max-width: 520px; margin: 0 auto; padding: 8px 20px 0; flex: 1; display: flex; flex-direction: column; }
.bill-title { margin: 6px 0 18px; font-size: 30px; font-weight: 700; letter-spacing: -.02em; }
.bill-card {
  background: var(--settings-surface); border-radius: 22px; overflow: hidden;
  backdrop-filter: var(--settings-frost); box-shadow: var(--settings-shadow);
}
.bill-loading { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 92px; font-size: 14px; color: var(--settings-muted); }
.bill-empty { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 30px 20px; font-size: 15px; }
.bill-row {
  position: relative; width: 100%; display: flex; align-items: center; gap: 13px;
  min-height: 62px; padding: 10px 16px; border: 0; background: transparent;
  color: var(--settings-ink); text-align: start; font-family: inherit; cursor: default;
}
.bill-row + .bill-row::before {
  content: ""; position: absolute; top: 0; inset-inline-start: 60px; inset-inline-end: 0;
  height: 1px; background: var(--settings-line);
}
.bill-row-tap { cursor: pointer; transition: background .2s; }
.bill-row-tap:active { background: var(--settings-line); }
.bill-tile {
  width: 34px; height: 34px; flex-shrink: 0; display: grid; place-items: center;
  border-radius: 11px; background: var(--settings-line); color: var(--settings-muted);
}
.bill-tile-icon { width: 17px; height: 17px; }
.bill-tone-blue .bill-tile { background: color-mix(in oklch, var(--settings-blue) 14%, transparent); color: var(--settings-blue); }
.bill-tone-violet .bill-tile { background: color-mix(in oklch, var(--settings-violet) 14%, transparent); color: var(--settings-violet); }
.bill-tone-green .bill-tile { background: color-mix(in oklch, var(--settings-green) 16%, transparent); color: var(--settings-green); }
.bill-tone-yellow .bill-tile { background: color-mix(in oklch, var(--settings-yellow) 18%, transparent); color: var(--settings-yellow); }
.bill-value { font-size: 13.5px; color: var(--settings-muted); font-variant-numeric: tabular-nums; }
.bill-chev { width: 19px; height: 19px; flex-shrink: 0; color: var(--settings-muted); opacity: .55; }
.bill-sec { margin: 26px 4px 10px; font-size: 19px; font-weight: 700; letter-spacing: -.01em; }
.bill-none { padding: 18px 16px; font-size: 14px; color: var(--settings-muted); }
.bill-foot { margin-top: auto; padding: 30px 0 max(26px, env(safe-area-inset-bottom)); }
.bill-pill {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: 52px; padding: 0 22px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--settings-surface); color: var(--settings-ink);
  font-family: inherit; font-size: 16px; font-weight: 600;
  backdrop-filter: var(--settings-frost); box-shadow: var(--settings-shadow);
  transition: transform .2s cubic-bezier(.22,1,.36,1), background .2s;
}
.bill-pill:active { transform: scale(.985); background: var(--settings-line); }
.bill-pill-wide { width: 100%; }
.bill-scrim {
  position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center;
  background: color-mix(in oklch, oklch(.2 .005 255) 45%, transparent);
  backdrop-filter: blur(6px); animation: bill-fade .25s ease both;
}
.bill-sheet {
  width: 100%; max-width: 520px; padding: 10px 20px max(24px, env(safe-area-inset-bottom));
  background: var(--settings-backdrop); background-attachment: fixed;
  border-radius: 26px 26px 0 0; box-shadow: var(--settings-shadow);
  animation: bill-sheet-in .42s cubic-bezier(.22,1,.36,1) both;
}
.bill-sheet-bar { width: 38px; height: 4px; margin: 0 auto 12px; border-radius: 999px; background: var(--settings-line); }
.bill-sheet-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.bill-sheet-title { margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -.01em; }
.bill-sheet-body { display: flex; flex-direction: column; gap: 2px; margin-bottom: 20px; padding: 4px 0; }
.bill-fact { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 46px; font-size: 15px; }
.bill-fact + .bill-fact { border-top: 1px solid var(--settings-line); }
.bill-fact-label { color: var(--settings-muted); }
.bill-fact-value { font-weight: 600; text-transform: capitalize; font-variant-numeric: tabular-nums; }
@keyframes bill-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes bill-sheet-in { from { opacity: .5; translate: 0 12%; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .bill-scrim, .bill-sheet { animation: none; }
  .bill-hbtn, .bill-pill, .bill-row-tap { transition: none; }
}
`;

/**
 * @doc Billing — the single statement page (Cash App reference design).
 * Plain white sheet: back + help top bar, big title, thin outlined icon rows
 * (renewal, amount, auto pay), past statements, one large rounded "View bill".
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Wallet,
  RefreshCcw,
  FileText,
  ChevronRight,
  HelpCircle,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunction";
import { claimDailyCredits, fetchCreditOverview } from "@/lib/creditsSystem";
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
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
  amount_cents: number | null;
  currency: string | null;
  created_at: string | null;
};

const fmtDate = (s: string | null | undefined, lang: AuthLang) =>
  s
    ? new Date(s).toLocaleDateString(lang === "ar-eg" ? "ar-EG" : "en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

/* ── Row with a thin outlined icon, label over value, optional chevron ── */
const IconRow = ({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  onClick?: () => void;
}) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-4 py-4 text-start ${
        onClick ? "transition active:opacity-60" : ""
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border">
        <Icon className="h-[18px] w-[18px] text-foreground" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-[13.5px] text-muted-foreground">{value}</span>
      </span>
      {onClick && (
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" strokeWidth={1.8} />
      )}
    </Tag>
  );
};

const UsagePage = () => {
  const navigate = useNavigate();
  const lang = useUserLang();
  const copy = (s: string) => translateExactText(s, lang);

  const [credits, setCredits] = useState(0);
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!dead) setLoading(false);
        return;
      }
      await claimDailyCredits();
      const [overview, profile, subData] = await Promise.all([
        fetchCreditOverview().catch(() => null),
        supabase.from("profiles").select("credits").eq("id", user.id).single(),
        supabase
          .from("subscriptions")
          .select("plan, status, current_period_end, amount_cents, currency, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (dead) return;
      if (overview) setCredits(Number(overview.credits) || 0);
      else if (profile.data) setCredits(Number(profile.data.credits) || 0);
      if (subData.data) setSub(subData.data as Sub);
      setLoading(false);
    })();
    return () => {
      dead = true;
    };
  }, []);

  const isActive = !cancelled && (sub?.status === "active" || sub?.status === "trialing");
  const amountLabel = sub?.amount_cents
    ? `${(sub.amount_cents / 100).toFixed(0)} ${sub.currency || "EGP"}`
    : `${credits.toLocaleString(lang === "ar-eg" ? "ar-EG" : "en-US")} MC`;

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

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground" dir={lang === "ar-eg" ? "rtl" : "ltr"}>
      {/* Top bar: back + help */}
      <header
        className="flex items-center justify-between px-4 pb-2"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
      >
        <button
          type="button"
          aria-label={copy("Back")}
          onClick={() => navigate("/settings")}
          className="flex h-10 w-10 items-center justify-center rounded-full transition active:opacity-60"
        >
          <ChevronLeft className="h-6 w-6 text-foreground rtl:rotate-180" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label={copy("Help")}
          onClick={() => navigate("/support")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition active:opacity-60"
        >
          <HelpCircle className="h-5 w-5 text-foreground" strokeWidth={1.8} />
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5">
        <h1 className="mt-2 text-[30px] font-bold tracking-[-0.02em] text-foreground">
          {copy("Billing")}
        </h1>

        {/* Statement rows */}
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[13.5px]">{copy("Loading…")}</span>
            </div>
          ) : (
            <>
              <IconRow
                icon={CalendarDays}
                label={copy("Next renewal")}
                value={
                  isActive && sub?.current_period_end
                    ? fmtDate(sub.current_period_end, lang)
                    : copy("No active subscription")
                }
              />
              <IconRow icon={Wallet} label={copy("Amount")} value={amountLabel} />
              <IconRow
                icon={RefreshCcw}
                label={copy("Auto pay")}
                value={isActive ? copy("On") : copy("Off")}
                onClick={() =>
                  isActive ? setConfirmCancel(true) : navigate("/pricing")
                }
              />
            </>
          )}
        </div>

        {/* Past statements */}
        <h2 className="mt-10 text-[20px] font-bold tracking-[-0.01em] text-foreground">
          {copy("Past statements")}
        </h2>
        <div className="mt-2">
          {sub?.created_at ? (
            <IconRow
              icon={FileText}
              label={fmtDate(sub.created_at, lang)}
              value={
                sub.amount_cents
                  ? `${(sub.amount_cents / 100).toFixed(0)} ${sub.currency || "EGP"}`
                  : copy("Free")
              }
              onClick={() => toast.info(copy("Statement details coming soon"))}
            />
          ) : (
            <p className="py-4 text-[13.5px] text-muted-foreground">{copy("No statements yet")}</p>
          )}
        </div>

        {/* View bill */}
        <div className="mt-auto pb-10 pt-10">
          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="flex h-[54px] w-full items-center justify-center rounded-full bg-muted text-[16px] font-semibold text-foreground transition active:scale-[0.99] active:opacity-80"
          >
            {copy("View bill")}
          </button>
        </div>
      </main>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent dir={lang === "ar-eg" ? "rtl" : "ltr"}>
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

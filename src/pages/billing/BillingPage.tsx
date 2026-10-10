/**
 * @doc Billing — minimal statement-style page (Cash App reference design).
 * Clean white sheet: big title, thin outlined icon rows (renewal, amount,
 * auto pay), past statements list, and one large rounded "View bill" button.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarDays,
  Wallet,
  RefreshCcw,
  FileText,
  ChevronRight,
  HelpCircle,
  ChevronLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { translateExactText, useUserLang, type AuthLang } from "@/lib/authI18n";

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

const BillingPage = () => {
  const navigate = useNavigate();
  const lang = useUserLang();
  const copy = (s: string) => translateExactText(s, lang);

  const [credits, setCredits] = useState(0);
  const [sub, setSub] = useState<Sub | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();
      if (profile) setCredits(Number(profile.credits) || 0);
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("plan, status, current_period_end, amount_cents, currency, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subData) setSub(subData as Sub);
    })();
  }, []);

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const amountLabel = sub?.amount_cents
    ? `${(sub.amount_cents / 100).toFixed(0)} ${sub.currency || "EGP"}`
    : `${credits.toLocaleString(lang === "ar-eg" ? "ar-EG" : "en-US")} MC`;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
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
          <IconRow
            icon={CalendarDays}
            label={copy("Next renewal")}
            value={isActive && sub?.current_period_end ? fmtDate(sub.current_period_end, lang) : copy("No active subscription")}
          />
          <IconRow icon={Wallet} label={copy("Amount")} value={amountLabel} />
          <IconRow
            icon={RefreshCcw}
            label={copy("Auto pay")}
            value={isActive ? copy("On") : copy("Off")}
            onClick={() => navigate("/pricing")}
          />
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
              value={sub.amount_cents ? `${(sub.amount_cents / 100).toFixed(0)} ${sub.currency || "EGP"}` : copy("Free")}
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
    </div>
  );
};

export default BillingPage;

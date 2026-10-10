/** @doc Language settings — English or Egyptian Arabic, big cards with cartoon waving flags. */
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AVAILABLE_LANGS, setUserLang, translateExactText, useUserLang, type AuthLang } from "@/lib/authI18n";

/* Cartoon flags: chunky outline, waving shape, soft shine. Flag colours are
   the countries' real colours, so they are intentionally literal. */
const WAVE = "M8 14 C22 6 34 22 50 14 C66 6 78 22 92 14 L92 66 C78 74 66 58 50 66 C34 74 22 58 8 66 Z";

function FlagFrame({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 100 84" className="h-full w-full" aria-hidden>
      <defs>
        <clipPath id={`clip-${id}`}>
          <path d={WAVE} />
        </clipPath>
      </defs>
      <rect x="4" y="8" width="5" height="74" rx="2.5" fill="#6b4a2b" stroke="#2b1d12" strokeWidth="2.5" />
      <circle cx="6.5" cy="8" r="4.5" fill="#f5c542" stroke="#2b1d12" strokeWidth="2.5" />
      <g clipPath={`url(#clip-${id})`}>{children}</g>
      <path d="M14 20 C26 14 34 26 48 20" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
      <path d={WAVE} fill="none" stroke="#2b1d12" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

function FlagGB() {
  return (
    <FlagFrame id="gb">
      <rect x="0" y="0" width="100" height="84" fill="#1f4aa8" />
      <path d="M0 0 L100 84 M100 0 L0 84" stroke="#fff" strokeWidth="16" />
      <path d="M0 0 L100 84 M100 0 L0 84" stroke="#d62839" strokeWidth="6" />
      <path d="M50 0 V84 M0 40 H100" stroke="#fff" strokeWidth="20" />
      <path d="M50 0 V84 M0 40 H100" stroke="#d62839" strokeWidth="11" />
    </FlagFrame>
  );
}

function FlagEG() {
  return (
    <FlagFrame id="eg">
      <rect x="0" y="0" width="100" height="30" fill="#d62839" />
      <rect x="0" y="30" width="100" height="20" fill="#fff" />
      <rect x="0" y="50" width="100" height="34" fill="#1d1d1f" />
      <path d="M50 32 l5 5 -2 9 h-6 l-2 -9 z" fill="#e0a526" stroke="#2b1d12" strokeWidth="1.2" />
    </FlagFrame>
  );
}

const FLAGS: Record<string, () => JSX.Element> = { en: FlagGB, "ar-eg": FlagEG };

export default function LanguagePage() {
  const navigate = useNavigate();
  const lang = useUserLang();
  const ar = lang === "ar-eg";
  const tx = (s: string) => translateExactText(s, lang);

  const pick = async (code: AuthLang) => {
    if (code === lang) return;
    await setUserLang(code);
    toast.success(tx("Language updated"));
  };

  return (
    <div className="gx-root" dir={ar ? "rtl" : "ltr"}>
      <style>{languageCss}</style>
      <div className="gx-screen">
        <header className="gx-top">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate("/settings", { replace: true })}
            className="gx-hbtn"
          >
            <ChevronLeft className="gx-hicon rtl:rotate-180" strokeWidth={2} />
          </button>
        </header>

        <h1 className="gx-title">{tx("Language")}</h1>
        <p className="gx-sub">{tx("Pick how Megsy talks to you.")}</p>

        <div className="gx-content">
          <div className="lang-grid">
            {AVAILABLE_LANGS.map((l, i) => {
              const Flag = FLAGS[l.code] ?? FlagGB;
              const active = lang === l.code;
              return (
                <motion.button
                  key={l.code}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => pick(l.code as AuthLang)}
                  className={`gx-card lang-card ${active ? "gx-card-selected" : ""}`}
                >
                  {active && (
                    <span className="lang-check">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                  <motion.span
                    className="lang-flag"
                    animate={active ? { rotate: [0, -4, 3, 0] } : { rotate: 0 }}
                    transition={{ duration: 1.6, repeat: active ? Infinity : 0, ease: "easeInOut" }}
                    style={{ transformOrigin: "10% 90%" }}
                  >
                    <Flag />
                  </motion.span>
                  <span className="lang-native">{l.native}</span>
                  <span className="lang-label">{l.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
        <div className="gx-spacer" />
      </div>
    </div>
  );
}

const languageCss = `
.lang-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.lang-card {
  position: relative; display: flex; flex-direction: column; align-items: center;
  padding: 26px 16px 22px; border: 0; cursor: pointer; font: inherit; color: inherit;
}
.lang-check {
  position: absolute; inset-inline-end: 12px; top: 12px;
  display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px;
  background: var(--settings-violet); color: var(--settings-surface);
  box-shadow: var(--settings-shadow);
}
.lang-flag { display: block; width: 7rem; height: 6rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.18)); }
.lang-native { margin-top: 16px; font-size: 17px; font-weight: 700; }
.lang-label { margin-top: 2px; font-size: 12.5px; color: var(--settings-muted); }
`;

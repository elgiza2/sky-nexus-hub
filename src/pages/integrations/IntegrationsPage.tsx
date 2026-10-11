/** @doc Apps — glass shelf of integrations: search, connected first, tidy rows. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { integrations as CATALOG } from "@/lib/integrationsData";
import { loadIntegrationConnections } from "@/lib/integrationBackend";
import { IntegrationLogo } from "@/components/chat/integrations/IntegrationRow";
import { useUserLang } from "@/lib/authI18n";

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const ar = useUserLang() === "ar-eg";
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = "Apps — Megsy";
    loadIntegrationConnections(CATALOG)
      .then((s) => setConnected(s.connectedApps || {}))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? CATALOG.filter((i) => `${i.name} ${i.description ?? ""}`.toLowerCase().includes(q))
      : CATALOG;
  }, [query]);
  const mine = filtered.filter((i) => connected[i.app]);
  const rest = filtered.filter((i) => !connected[i.app]);

  const Rows = ({ items, divided }: { items: typeof CATALOG; divided: boolean }) => (
    <section className="gx-card">
      {items.map((item, i) => {
        const on = !!connected[item.app];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(`/integrations/${encodeURIComponent(item.app)}`)}
            className={`int-row${(divided || i > 0) && i > 0 ? " int-row-div" : ""}`}
          >
            <span className="int-logo">
              <IntegrationLogo item={item} size={26} />
            </span>
            <span className="int-text">
              <span className="int-name">{item.name}</span>
              {item.description ? <span className="int-desc">{item.description}</span> : null}
            </span>
            {on && (
              <span className="int-chip" title={ar ? "متصل" : "Connected"}>
                <Check strokeWidth={3} />
              </span>
            )}
            <ChevronRight className="int-chev rtl:rotate-180" strokeWidth={1.9} />
          </button>
        );
      })}
    </section>
  );

  return (
    <div className="gx-root" dir={ar ? "rtl" : "ltr"}>
      <style>{integrationsCss}</style>
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

        <h1 className="gx-title">{ar ? "التطبيقات" : "Apps"}</h1>
        <p className="gx-sub">
          {ar
            ? "اربط تطبيقاتك وميغسي هيستخدمها وقت ما يحتاج."
            : "Connect your apps and Megsy uses them when needed."}
        </p>

        <div className="gx-content">
          <div className="int-search">
            <Search className="int-search-icon" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? "ابحث" : "Search"}
              aria-label={ar ? "ابحث" : "Search"}
              className="int-search-input"
            />
          </div>

          {loading ? (
            <div className="gx-card gx-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="gx-empty">{ar ? "لا نتائج" : "No results"}</p>
          ) : (
            <>
              {mine.length > 0 && (
                <>
                  <h2 className="gx-section-title int-section">{ar ? "متصل" : "Connected"}</h2>
                  <Rows items={mine} divided={false} />
                </>
              )}
              <h2 className="gx-section-title int-section">
                {mine.length > 0 ? (ar ? "كل التطبيقات" : "All apps") : ar ? "التطبيقات" : "Apps"}
              </h2>
              <Rows items={rest} divided={mine.length === 0} />
            </>
          )}
        </div>
        <div className="gx-spacer" />
      </div>
    </div>
  );
}

const integrationsCss = `
.int-search { position: relative; display: flex; align-items: center; margin-bottom: 18px; }
.int-search-icon { position: absolute; inset-inline-start: 16px; width: 16px; height: 16px; color: var(--settings-muted); pointer-events: none; }
.int-search-input {
  width: 100%; height: 46px; padding: 0 16px 0 42px; border-radius: 999px;
  border: 1px solid var(--settings-line); background: var(--settings-surface);
  -webkit-backdrop-filter: var(--settings-frost); backdrop-filter: var(--settings-frost);
  color: var(--settings-ink); font: inherit; font-size: 14.5px; outline: none;
  box-shadow: var(--settings-shadow);
}
[dir="rtl"] .int-search-input { padding: 0 42px 0 16px; }
.int-search-input::placeholder { color: var(--settings-muted); }
.int-search-input:focus-visible { border-color: var(--settings-violet); }
.int-section { margin-top: 22px; }
.int-section:first-of-type { margin-top: 0; }
.int-row {
  width: 100%; display: flex; align-items: center; gap: 13px; padding: 12px 16px;
  border: 0; background: transparent; cursor: pointer; font: inherit; color: inherit;
  text-align: start; transition: background .18s ease;
}
.int-row-div { box-shadow: inset 0 1px 0 var(--settings-line); }
.int-row:active { background: var(--settings-line); }
.int-logo {
  flex: none; width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center;
  background: var(--settings-surface); box-shadow: inset 0 0 0 1px var(--settings-line);
  overflow: hidden;
}
.int-text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.int-name {
  font-size: 15px; font-weight: 620; letter-spacing: -.01em; color: var(--settings-ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.int-desc {
  font-size: 12.5px; line-height: 1.35; color: var(--settings-muted);
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
}
.int-chip {
  flex: none; width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center;
  background: var(--settings-violet); color: var(--settings-surface);
}
.int-chip > svg { width: 12px; height: 12px; }
.int-chev { flex: none; width: 18px; height: 18px; color: var(--settings-muted); }
`;

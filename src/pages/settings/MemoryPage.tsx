/** @doc Memory — what Megsy remembers about the user (user_knowledge): add, edit, toggle, delete, search. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, ChevronLeft, Loader2, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyTurnContextChanged } from "@/lib/chat/turnContext";
import { useUserLang } from "@/lib/authI18n";

type Row = {
  id: string;
  name: string;
  use_when: string;
  content: string;
  enabled: boolean;
  created_at: string;
};

type Draft = { id?: string; name: string; use_when: string; content: string };

const T = {
  en: {
    title: "Memory",
    sub: "Things Megsy remembers and uses in your chats.",
    search: "Search memory",
    add: "Add memory",
    edit: "Edit memory",
    empty: "Nothing here yet",
    emptySub: "Add a fact or instruction and Megsy will use it when it fits.",
    name: "Title",
    namePh: "e.g. My writing style",
    when: "Use when",
    whenPh: "When should Megsy use this?",
    content: "What to remember",
    contentPh: "Write the fact or instruction",
    save: "Save",
    saving: "Saving…",
    del: "Delete",
    confirmDel: "Delete this memory?",
    required: "Fill in “Use when” and “What to remember”",
    failed: "Could not save",
    delFailed: "Could not delete",
    on: "On",
    off: "Off",
    noResults: "No matches",
    untitled: "Untitled",
  },
  ar: {
    title: "الذاكرة",
    sub: "الحاجات اللي ميغسي فاكرها وبيستخدمها في محادثاتك.",
    search: "دوّر في الذاكرة",
    add: "إضافة ذكرى",
    edit: "تعديل الذكرى",
    empty: "لسه مفيش حاجة",
    emptySub: "ضيف معلومة أو تعليمات وميغسي هيستخدمها لما تناسب.",
    name: "العنوان",
    namePh: "مثلًا: أسلوب كتابتي",
    when: "تُستخدم لما",
    whenPh: "إمتى ميغسي يستخدم دي؟",
    content: "المطلوب تفتكره",
    contentPh: "اكتب المعلومة أو التعليمات",
    save: "حفظ",
    saving: "بيحفظ…",
    del: "حذف",
    confirmDel: "تحذف الذكرى دي؟",
    required: "اكتب «تُستخدم لما» و«المطلوب تفتكره»",
    failed: "مقدرناش نحفظ",
    delFailed: "مقدرناش نحذف",
    on: "شغّالة",
    off: "متوقفة",
    noResults: "مفيش نتايج",
    untitled: "بدون عنوان",
  },
};

export default function MemoryPage() {
  const navigate = useNavigate();
  const lang = useUserLang();
  const ar = lang === "ar-eg";
  const t = ar ? T.ar : T.en;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_knowledge")
      .select("id,name,use_when,content,enabled,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.name} ${r.use_when} ${r.content}`.toLowerCase().includes(s));
  }, [rows, q]);

  const save = async () => {
    if (!draft) return;
    if (!draft.use_when.trim() || !draft.content.trim()) {
      toast.error(t.required);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim().slice(0, 120),
        use_when: draft.use_when.trim().slice(0, 500),
        content: draft.content.trim().slice(0, 5000),
      };
      if (draft.id) {
        const { error } = await supabase.from("user_knowledge").update(payload).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("no user");
        const { error } = await supabase.from("user_knowledge").insert({ user_id: uid, ...payload });
        if (error) throw error;
      }
      setDraft(null);
      await load();
      notifyTurnContextChanged();
    } catch {
      toast.error(t.failed);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t.confirmDel)) return;
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    setDraft(null);
    const { error } = await supabase.from("user_knowledge").delete().eq("id", id);
    if (error) {
      setRows(prev);
      toast.error(t.delFailed);
      return;
    }
    notifyTurnContextChanged();
  };

  const toggle = async (row: Row) => {
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, enabled: !r.enabled } : r)));
    const { error } = await supabase.from("user_knowledge").update({ enabled: !row.enabled }).eq("id", row.id);
    if (error) {
      setRows((p) => p.map((r) => (r.id === row.id ? { ...r, enabled: row.enabled } : r)));
      toast.error(t.failed);
      return;
    }
    notifyTurnContextChanged();
  };

  return (
    <div className="gx-root" dir={ar ? "rtl" : "ltr"}>
      <style>{memoryCss}</style>
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
          <div className="gx-top-trail">
            <button type="button" onClick={() => setDraft({ name: "", use_when: "", content: "" })} className="gx-pill mem-add">
              <Plus className="h-4 w-4" /> {t.add}
            </button>
          </div>
        </header>

        <h1 className="gx-title">{t.title}</h1>
        <p className="gx-sub">{t.sub}</p>

        <div className="gx-content">
          {rows.length > 0 && (
            <div className="gx-field">
              <div className="mem-search">
                <Search className="mem-search-icon" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t.search}
                  className="gx-input mem-search-input"
                />
              </div>
            </div>
          )}

          {loading ? (
            <div className="gx-card gx-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="gx-card gx-empty">
              <span className="gx-tile mem-empty-tile">
                <Sparkles strokeWidth={1.7} />
              </span>
              <p className="mem-empty-title">{t.empty}</p>
              <p>{t.emptySub}</p>
              <button
                type="button"
                onClick={() => setDraft({ name: "", use_when: "", content: "" })}
                className="gx-pill"
              >
                <Plus className="h-4 w-4" /> {t.add}
              </button>
            </div>
          ) : shown.length === 0 ? (
            <p className="gx-empty">{t.noResults}</p>
          ) : (
            <section className="gx-card">
              {shown.map((r) => (
                <div key={r.id} className={`gx-row gx-tone-violet ${r.enabled ? "" : "mem-row-off"}`}>
                  <span className="gx-tile">
                    <Brain strokeWidth={1.7} />
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraft({ id: r.id, name: r.name, use_when: r.use_when, content: r.content })}
                    className="gx-row-body mem-row-btn"
                  >
                    <span className="gx-row-label">{r.name || t.untitled}</span>
                    <span className="gx-row-hint mem-row-content">{r.content}</span>
                    <span className="gx-row-hint mem-row-when">
                      {t.when}: {r.use_when}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.enabled}
                    aria-label={r.enabled ? t.on : t.off}
                    onClick={() => toggle(r)}
                    className={`mem-switch ${r.enabled ? "is-on" : ""}`}
                  >
                    <span className="mem-switch-knob" />
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
        <div className="gx-spacer" />
      </div>

      {draft && (
        <div className="gx-scrim" onClick={() => setDraft(null)}>
          <div className="gx-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="gx-sheet-bar" />
            <div className="gx-sheet-head">
              <button type="button" aria-label="Close" onClick={() => setDraft(null)} className="gx-hbtn gx-hbtn-sm">
                <X className="gx-hicon" strokeWidth={2} />
              </button>
              <h3 className="gx-sheet-title">{draft.id ? t.edit : t.add}</h3>
              <button type="button" onClick={save} disabled={saving} className="gx-pill gx-hbtn-sm mem-save-pill">
                {saving ? t.saving : t.save}
              </button>
            </div>

            <div className="gx-sheet-body mem-fields">
              <div className="gx-field">
                <span className="gx-field-label">{t.name}</span>
                <input
                  value={draft.name}
                  maxLength={120}
                  placeholder={t.namePh}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="gx-input"
                />
              </div>
              <div className="gx-field">
                <span className="gx-field-label">{t.when} *</span>
                <textarea
                  value={draft.use_when}
                  maxLength={500}
                  rows={2}
                  placeholder={t.whenPh}
                  onChange={(e) => setDraft({ ...draft, use_when: e.target.value })}
                  className="gx-input mem-textarea"
                />
              </div>
              <div className="gx-field">
                <span className="gx-field-label">{t.content} *</span>
                <textarea
                  value={draft.content}
                  maxLength={5000}
                  rows={5}
                  placeholder={t.contentPh}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  className="gx-input mem-textarea"
                />
              </div>
              {draft.id && (
                <button type="button" onClick={() => remove(draft.id!)} className="gx-pill gx-pill-danger mem-del-btn">
                  <Trash2 className="h-4 w-4" /> {t.del}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const memoryCss = `
.mem-add { min-height: 40px; padding: 0 16px; font-size: 13px; }
.mem-search { position: relative; display: flex; align-items: center; }
.mem-search-icon { position: absolute; inset-inline-start: 14px; width: 16px; height: 16px; color: var(--settings-muted); pointer-events: none; }
.mem-search-input { padding-inline-start: 40px; border-radius: 999px; }
.mem-empty-tile { width: 56px; height: 56px; border-radius: 18px; }
.mem-empty-tile > svg { width: 26px; height: 26px; }
.mem-empty-title { font-size: 16px; font-weight: 700; color: var(--settings-ink); }
.mem-row-off { opacity: 0.55; }
.mem-row-btn { background: transparent; border: 0; cursor: pointer; text-align: start; padding: 0; font: inherit; }
.mem-row-content { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mem-row-when { opacity: 0.8; }
.mem-switch {
  position: relative; width: 40px; height: 24px; flex-shrink: 0; border-radius: 999px; border: 0; cursor: pointer;
  background: var(--settings-line); transition: background 0.2s;
}
.mem-switch.is-on { background: var(--settings-violet); }
.mem-switch-knob {
  position: absolute; top: 2px; inset-inline-start: 2px; width: 20px; height: 20px; border-radius: 999px;
  background: var(--settings-surface); box-shadow: var(--settings-shadow); transition: inset-inline-start 0.2s;
}
.mem-switch.is-on .mem-switch-knob { inset-inline-start: 18px; }
.mem-save-pill { width: auto; min-height: 40px; padding: 0 18px; font-size: 13px; }
.mem-fields { gap: 16px; }
.mem-textarea { resize: none; }
.mem-del-btn { width: auto; min-height: 40px; padding: 0 16px; font-size: 13px; align-self: flex-start; }
`;

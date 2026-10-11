import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, m as motion } from "framer-motion";

import { useNavigate } from "react-router-dom";
import { PrefetchLink as Link } from "@/components/common/PrefetchLink";
import {
  Bot,
  ChevronRight,
  Copy,
  EllipsisVertical,
  Globe,
  Loader2,
  Lock,
  MessagesSquare,
  Share2,
  UserPlus,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";
import { getCachedUser } from "@/lib/cachedUser";
import { prefetchRoute } from "@/hooks/usePrefetchRoute";
import { t as uiT, useUserLang } from "@/lib/authI18n";
import { UpgradePlanButton } from "@/components/billing/UpgradePlanButton";


type MenuView = "main" | "rename" | "invite" | "share" | "delete";

const MEGSY_APP_ICON = "/favicon.png";

/* Reference layout: avatar, one wide segmented control, one round action. */
const HEADER_CSS = `
  .mch-avatar {
    flex: none; width: 38px; height: 38px; border-radius: 999px; overflow: hidden;
    display: grid; place-items: center; border: 0; padding: 0; cursor: pointer;
    background: hsl(var(--foreground) / 0.08); color: hsl(var(--foreground));
    font-size: 15px; font-weight: 600; line-height: 1;
    box-shadow: inset 0 0 0 1px hsl(var(--foreground) / 0.06);
    -webkit-tap-highlight-color: transparent;
  }
  .mch-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .mch-avatar:active { transform: scale(.94); }

  .mch-seg {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px;
    padding: 3px; border-radius: 999px; background: hsl(var(--foreground) / 0.06);
  }
  .mch-seg-btn {
    flex: 1; min-width: 0; height: 34px; display: inline-flex; align-items: center;
    justify-content: center; gap: 6px; border: 0; border-radius: 999px;
    background: transparent; color: hsl(var(--foreground) / 0.55);
    font: inherit; font-size: 13px; font-weight: 600; letter-spacing: -.01em;
    cursor: pointer; transition: background .2s ease, color .2s ease, box-shadow .2s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .mch-seg-btn > svg { width: 15px; height: 15px; flex: none; }
  .mch-seg-btn[data-on="true"] {
    background: hsl(var(--background)); color: hsl(var(--foreground));
    box-shadow: 0 1px 6px -2px hsl(var(--foreground) / 0.4), inset 0 0 0 1px hsl(var(--foreground) / 0.06);
  }
  .mch-seg-btn:active { transform: scale(.97); }

  .mch-icon-btn {
    flex: none; width: 38px; height: 38px; border-radius: 999px; display: grid;
    place-items: center; border: 0; cursor: pointer;
    background: hsl(var(--foreground) / 0.06); color: hsl(var(--foreground));
    -webkit-tap-highlight-color: transparent;
  }
  .mch-icon-btn > svg { width: 18px; height: 18px; }
  .mch-icon-btn:active { transform: scale(.94); }
`;

const MegsySidebarToggleIcon = () => (
  // Clear sidebar/panel-left icon: panel outline with a left rail + content lines
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className="h-[22px] w-[22px]"
  >
    <rect
      x="3.25"
      y="4.5"
      width="17.5"
      height="15"
      rx="3.5"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <line x1="9.25" y1="4.5" x2="9.25" y2="19.5" stroke="currentColor" strokeWidth="1.6" />
    <line
      x1="5.5"
      y1="9"
      x2="7"
      y2="9"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <line
      x1="5.5"
      y1="12"
      x2="7"
      y2="12"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <line
      x1="5.5"
      y1="15"
      x2="7"
      y2="15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const NewChatComposeIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-[22px] w-[22px] text-foreground"
  >
    <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
  </svg>
);

export interface MobileChatHeaderProps {
  title?: string;
  hasConversation: boolean;
  isPinned?: boolean;
  onOpenSidebar: () => void;
  onNewChat: () => void;
  onShare: () => void;
  onInvite: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onDelete: () => void | Promise<void>;
  isDeleting?: boolean;
  rightSlot?: React.ReactNode;
  modelSlot?: React.ReactNode;
  /** Which half of the chat the bar is showing: the conversation or the agents. */
  tab?: "chat" | "agents";
  onTabChange?: (tab: "chat" | "agents") => void;
  chatUserId?: string | null;
  scrollContainerRef?: RefObject<HTMLElement | null>;


  // Inline view props (optional — when present, Share/Invite/Rename open inside the same menu)
  inlineRename?: {
    value: string;
    onChange: (v: string) => void;
    onSave: () => void;
  };
  inlineInvite?: {
    email: string;
    onEmailChange: (v: string) => void;
    onSend: () => void;
    loading?: boolean;
    link?: string | null;
    onCopyLink: () => void;
    onOpen: () => void;
  };
  inlineShare?: {
    mode: "private" | "public";
    onModeChange: (m: "private" | "public") => void;
    url?: string | null;
    onCopyLink: () => void;
    onOpen: () => void;
  };
}

export default function MobileChatHeader({
  hasConversation,
  isPinned,
  onOpenSidebar,
  onNewChat,
  onShare,
  onInvite,
  onRename,
  onTogglePin,
  onDelete,
  isDeleting,
  rightSlot,
  modelSlot,
  tab,
  onTabChange,
  chatUserId,
  scrollContainerRef,
  inlineRename,

  inlineInvite,
  inlineShare,
}: MobileChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>("main");
  const navigate = useNavigate();
  const activeTab = tab ?? "chat";

  // The avatar doubles as the drawer handle — it shows who is signed in.
  const [avatar, setAvatar] = useState<string | null>(null);
  const [initial, setInitial] = useState("M");
  useEffect(() => {
    let alive = true;
    void getCachedUser().then((user) => {
      if (!alive || !user) return;
      const meta = (user.user_metadata ?? {}) as Record<string, string>;
      setAvatar(meta.avatar_url || meta.picture || null);
      const name = meta.full_name || meta.name || user.email || "Megsy";
      setInitial(name.trim().charAt(0).toUpperCase() || "M");
    });
    return () => {
      alive = false;
    };
  }, []);

  // The header always uses the page background so it blends seamlessly with
  // the chat surface — no colour change on scroll.


  const lang = useUserLang();

  const prefetchPricing = () => {
    void prefetchRoute("/pricing");
  };

  const close = () => {
    setOpen(false);
    setMenuView("main");
  };
  const runAndClose = (fn: () => void) => {
    setOpen(false);
    setMenuView("main");
    setTimeout(fn, 60);
  };

  const goRename = () => {
    if (inlineRename) {
      onRename();
      setMenuView("rename");
    } else runAndClose(onRename);
  };
  const goInvite = () => {
    if (inlineInvite) {
      inlineInvite.onOpen();
      setMenuView("invite");
    } else runAndClose(onInvite);
  };
  const goShare = () => {
    if (inlineShare) {
      inlineShare.onOpen();
      setMenuView("share");
    } else runAndClose(onShare);
  };

  const items: Array<{ icon: typeof Share2; label: string; onClick: () => void }> = [
    { icon: Share2, label: "Share", onClick: goShare },
    { icon: UserPlus, label: "Invite people", onClick: goInvite },
    { icon: Pin, label: isPinned ? "Unpin chat" : "Pin chat", onClick: () => runAndClose(onTogglePin) },
    { icon: Pencil, label: "Rename", onClick: goRename },
  ];

  const confirmDelete = async () => {
    await onDelete();
    close();
  };

  return (
    <>
      <div
        data-testid="mobile-chat-header"
        style={{ top: "var(--promo-banner-h, 0px)" }}
        className="mobile-chat-header md:hidden fixed inset-x-0 z-[36] flex items-center gap-2 px-3 py-1.5 min-h-[54px] pt-[max(env(safe-area-inset-top),0.4rem)] pointer-events-none [&>*]:pointer-events-auto border-0 bg-background"
      >
        <style>{HEADER_CSS}</style>
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          data-testid="mobile-open-sidebar"
          className="mch-avatar"
        >
          {avatar ? <img src={avatar} alt="" /> : <span>{initial}</span>}
        </button>

        <div className="mch-seg" role="tablist" aria-label="Chat or agents">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "chat"}
            data-on={activeTab === "chat" ? "true" : "false"}
            onClick={() => onTabChange?.("chat")}
            className="mch-seg-btn"
          >
            <MessagesSquare strokeWidth={1.9} />
            <span>Chat</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "agents"}
            data-on={activeTab === "agents" ? "true" : "false"}
            onClick={() => onTabChange?.("agents")}
            className="mch-seg-btn"
          >
            <Bot strokeWidth={1.9} />
            <span>Agents</span>
          </button>
        </div>

        {/* Caller-provided actions (e.g. an upgrade CTA). */}
        {rightSlot}

        {chatUserId && !hasConversation && <UpgradePlanButton variant="compact" hideCredits />}

        {!chatUserId && (
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="btn-sunset h-9 px-4 rounded-2xl text-[13px] font-bold transition mb-0.5"
          >
            {uiT("Sign in", lang)}
          </button>
        )}

        {hasConversation && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Chat options"
            data-testid="mobile-chat-options"
            className="mch-icon-btn"
          >
            <EllipsisVertical strokeWidth={2} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="lg-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="md:hidden fixed inset-0 z-40 bg-transparent touch-none"
              onClick={() => {
                if (!isDeleting) close();
              }}
            />

            <motion.div
              key="lg-menu"
              data-testid="mobile-more-menu-content"
              initial={{ opacity: 0, scale: 0.92, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 0 }}
              transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
              style={{
                top: "calc(var(--promo-banner-h, 0px) + max(env(safe-area-inset-top), 0.25rem) + 0.375rem)",
                right: "12px",
                left: "auto",
                transformOrigin: "top right",
              }}
              className="mobile-more-glass-menu md:hidden fixed z-50 w-[260px] rounded-ios-lg overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                {menuView === "main" && (
                  <motion.div
                    key="menu-main"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="py-1.5"
                  >
                    {items.map(({ icon: Icon, label, onClick }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={onClick}
                        data-testid={`mobile-menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
                        className="mobile-more-glass-item w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-foreground/[0.08] text-foreground">
                        <Icon
                          className="w-[19px] h-[19px] text-foreground shrink-0"
                          strokeWidth={1.8}
                        />
                        <span className="flex-1 truncate text-[15px] font-medium text-left">
                          {label}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMenuView("delete")}
                      data-testid="mobile-menu-delete"
                       className="mobile-more-glass-item w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="w-[19px] h-[19px] shrink-0" strokeWidth={1.8} />
                      <span className="flex-1 truncate text-[15px] font-medium text-left">
                        Delete
                      </span>
                    </button>
                  </motion.div>
                )}

                {menuView === "rename" && inlineRename && (
                  <motion.div
                    key="menu-rename"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="p-3"
                  >
                    <BackButton onClick={() => setMenuView("main")} />
                    <div className="px-1 pb-2 text-right text-[14px] font-semibold text-foreground">
                      Rename chat
                    </div>
                    <input
                      autoFocus
                      dir="auto"
                      value={inlineRename.value}
                      onChange={(e) => inlineRename.onChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          inlineRename.onSave();
                          close();
                        }
                      }}
                      className="w-full h-10 rounded-xl bg-foreground/[0.06] border border-foreground/10 px-3 text-[14px] text-foreground outline-none focus:border-foreground/25"
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setMenuView("main")}
                        className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold text-muted-foreground active:bg-foreground/[0.08]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          inlineRename.onSave();
                          close();
                        }}
                        className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold bg-primary text-primary-foreground active:opacity-90"
                      >
                        Save
                      </button>
                    </div>
                  </motion.div>
                )}

                {menuView === "invite" && inlineInvite && (
                  <motion.div
                    key="menu-invite"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="p-3"
                  >
                    <BackButton onClick={() => setMenuView("main")} />
                    <div className="px-1 pb-1 text-right text-[14px] font-semibold text-foreground">
                      Invite people
                    </div>
                    <p className="px-1 pb-2 text-right text-[11px] text-muted-foreground">
                      Add someone to this chat
                    </p>
                    <div className="flex flex-col gap-2">
                      <input
                        dir="ltr"
                        value={inlineInvite.email}
                        onChange={(e) => inlineInvite.onEmailChange(e.target.value)}
                        placeholder="friend@example.com"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") inlineInvite.onSend();
                        }}
                        className="w-full h-10 rounded-xl bg-foreground/[0.06] border border-foreground/10 px-3 text-[13px] text-foreground outline-none focus:border-foreground/25"
                      />
                      <button
                        type="button"
                        onClick={inlineInvite.onSend}
                        disabled={inlineInvite.loading || !inlineInvite.email.trim()}
                        className="w-full h-10 rounded-xl text-[13px] font-semibold bg-white text-background shadow-sm active:opacity-90 disabled:opacity-50 inline-flex items-center justify-center whitespace-nowrap theme-fixed">
                        {inlineInvite.loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending…
                          </>
                        ) : (
                          "Send invite"
                        )}
                      </button>
                    </div>
                    {inlineInvite.link ? (
                      <button
                        type="button"
                        onClick={inlineInvite.onCopyLink}
                        className="mt-2 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-foreground/[0.06] active:bg-foreground/[0.10]"
      aria-label="Copy"
    >
                        <span className="text-[11px] text-foreground truncate" dir="ltr">
                          {inlineInvite.link}
                        </span>
                        <Copy className="w-3.5 h-3.5 text-foreground shrink-0" />
                      </button>
                    ) : (
                      <p className="mt-2 text-center text-[11px] text-muted-foreground">
                        Generating link…
                      </p>
                    )}
                  </motion.div>
                )}

                {menuView === "share" && inlineShare && (
                  <motion.div
                    key="menu-share"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="p-3"
                  >
                    <BackButton onClick={() => setMenuView("main")} />
                    <div className="px-1 pb-1 text-right text-[14px] font-semibold text-foreground">
                      Share chat
                    </div>
                    <p className="px-1 pb-2 text-right text-[11px] text-muted-foreground">
                      Future messages aren't included
                    </p>
                    <div className="rounded-xl border border-foreground/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => inlineShare.onModeChange("private")}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 ${inlineShare.mode === "private" ? "bg-foreground/[0.10]" : "active:bg-foreground/[0.06]"}`}
                      >
                        <Lock className="w-3.5 h-3.5 text-foreground shrink-0" />
                        <div className="text-right flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-foreground">
                            Keep private
                          </p>
                          <p className="text-[10.5px] text-muted-foreground">
                            Only you have access
                          </p>
                        </div>
                      </button>
                      <div className="h-px bg-foreground/10" />
                      <button
                        type="button"
                        onClick={() => inlineShare.onModeChange("public")}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 ${inlineShare.mode === "public" ? "bg-foreground/[0.10]" : "active:bg-foreground/[0.06]"}`}
                      >
                        <Globe className="w-3.5 h-3.5 text-foreground shrink-0" />
                        <div className="text-right flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-foreground">
                            Create public link
                          </p>
                          <p className="text-[10.5px] text-muted-foreground">
                            Anyone with the link can view
                          </p>
                        </div>
                      </button>
                    </div>
                    {inlineShare.mode === "public" && (
                      <div className="mt-3">
                        {inlineShare.url ? (
                          <button
                            type="button"
                            onClick={inlineShare.onCopyLink}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-foreground/[0.06] active:bg-foreground/[0.10]"
      aria-label="Copy"
    >
                            <span className="text-[11px] text-foreground truncate" dir="ltr">
                              {inlineShare.url}
                            </span>
                            <Copy className="w-3.5 h-3.5 text-foreground shrink-0" />
                          </button>
                        ) : (
                          <p className="text-center text-[11px] text-muted-foreground py-1">
                            Generating link…
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {menuView === "delete" && (
                  <motion.div
                    key="menu-delete"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="p-3"
                  >
                    <BackButton onClick={() => setMenuView("main")} disabled={isDeleting} />
                    <div className="px-1 pb-3 text-right">
                      <div className="text-[14px] font-semibold text-foreground">Delete chat?</div>
                      <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                        This conversation will be permanently removed.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMenuView("main")}
                        disabled={isDeleting}
                        className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors active:bg-foreground/[0.08] disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDelete}
                        disabled={isDeleting}
                        className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold bg-destructive text-foreground transition-opacity active:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Delete
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mb-2 flex items-center gap-1 text-[12px] font-medium text-muted-foreground active:text-foreground disabled:opacity-50"
    >
      <ChevronRight className="w-3.5 h-3.5 rotate-180" />
      Back
    </button>
  );
}

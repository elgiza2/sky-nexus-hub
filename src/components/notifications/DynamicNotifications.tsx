/**
 * @doc In-app notifications shaped like a Dynamic Island: a small pill at the
 * top of the screen drops, stretches into a card and collapses again when it is
 * done. Same idea as expo-dynamic-notifications, rebuilt for the web with the
 * glass language the rest of Megsy already speaks.
 *
 * Wrap the app once in <DynamicNotifications> and fire from anywhere:
 *   const { trigger } = useDynamicNotifications();
 *   trigger({ title: "Saved", message: "Your draft is safe." });
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type DynamicNotification = {
  /** Your identifier, handed back through onDismiss. */
  id?: string;
  /** Bold first line. */
  title: string;
  /** Secondary line. */
  message?: string;
  /** Image shown in the round leading slot. */
  avatar?: string;
  /** Custom leading slot; wins over `avatar`. */
  leading?: ReactNode;
  /** Small mark on the trailing side. */
  symbol?: ReactNode;
  /** Tint for the title. */
  accent?: string;
  /** Lifetime in ms. null keeps it on screen until it is dismissed. */
  duration?: number | null;
  onPress?: () => void;
  /** Replace the whole body; the morph and dismiss gesture still apply. */
  render?: (n: DynamicNotification) => ReactNode;
};

type Ctx = {
  trigger: (n: DynamicNotification) => void;
  dismiss: () => void;
  isVisible: boolean;
  notification: DynamicNotification | null;
};

const DynamicNotificationsCtx = createContext<Ctx | null>(null);

export const useDynamicNotifications = (): Ctx =>
  useContext(DynamicNotificationsCtx) ?? {
    trigger: () => {},
    dismiss: () => {},
    isVisible: false,
    notification: null,
  };

/** Cards stay this long unless the notification overrides it. */
const DEFAULT_DURATION = 3600;
/** Keep in step with the .mgx-notif transitions below. */
const OPEN_MS = 520;
const CLOSE_MS = 380;

export function DynamicNotifications({
  children,
  duration = DEFAULT_DURATION,
  onDismiss,
  accent,
}: {
  children?: ReactNode;
  duration?: number | null;
  onDismiss?: (n: DynamicNotification) => void;
  accent?: string;
}) {
  const [current, setCurrent] = useState<DynamicNotification | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<number | null>(null);
  const closer = useRef<number | null>(null);
  const opener = useRef<number | null>(null);

  const clearTimers = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (closer.current) window.clearTimeout(closer.current);
    if (opener.current) window.clearTimeout(opener.current);
    timer.current = closer.current = opener.current = null;
  };

  const dismiss = useCallback(() => {
    clearTimers();
    setOpen(false);
    // Collapse first, then unmount — the reverse of how it arrived.
    closer.current = window.setTimeout(() => {
      setMounted(false);
      setCurrent((n) => {
        if (n) onDismiss?.(n);
        return null;
      });
    }, CLOSE_MS);
  }, [onDismiss]);

  const trigger = useCallback(
    (n: DynamicNotification) => {
      clearTimers();
      setCurrent(n);
      setMounted(true);
      setOpen(false);
      // One frame as a pill, then stretch into the card.
      opener.current = window.setTimeout(() => setOpen(true), 30);
      const life = n.duration === undefined ? duration : n.duration;
      if (life !== null) {
        timer.current = window.setTimeout(() => dismiss(), OPEN_MS + life);
      }
    },
    [dismiss, duration],
  );

  useEffect(() => clearTimers, []);

  const value = useMemo<Ctx>(
    () => ({ trigger, dismiss, isVisible: mounted, notification: current }),
    [trigger, dismiss, mounted, current],
  );

  const tint = current?.accent ?? accent;

  return (
    <DynamicNotificationsCtx.Provider value={value}>
      {children}
      <style>{NOTIF_CSS}</style>
      <div className="mgx-notif-root" aria-live="polite" aria-atomic="true">
        {mounted && current && (
          <div
            className="mgx-notif"
            data-open={open ? "true" : "false"}
            style={{ ["--mgx-accent" as any]: tint ?? "var(--settings-ink, #f5f5f7)" }}
            role="status"
            onClick={() => {
              current.onPress?.();
              dismiss();
            }}
          >
            <span className="mgx-notif__droplet" aria-hidden />
            <div className="mgx-notif__body">
              {current.render ? (
                current.render(current)
              ) : (
                <>
                  <span className="mgx-notif__lead">
                    {current.leading ??
                      (current.avatar ? <img src={current.avatar} alt="" loading="lazy" decoding="async" /> : null)}
                  </span>
                  <span className="mgx-notif__text">
                    <span className="mgx-notif__title">{current.title}</span>
                    {current.message ? <span className="mgx-notif__message">{current.message}</span> : null}
                  </span>
                  {current.symbol ? <span className="mgx-notif__symbol">{current.symbol}</span> : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DynamicNotificationsCtx.Provider>
  );
}

const NOTIF_CSS = `
  .mgx-notif-root {
    position: fixed; inset-inline: 0; top: 0; z-index: 300;
    display: flex; justify-content: center;
    padding-top: calc(env(safe-area-inset-top, 0px) + 12px);
    pointer-events: none;
  }
  .mgx-notif {
    pointer-events: auto;
    position: relative;
    display: grid;
    align-content: center;
    width: 126px; height: 37px;
    border-radius: 999px;
    background: #0a0b10;
    box-shadow: 0 10px 30px rgba(16, 19, 28, 0.34), 0 1px 0 rgba(255, 255, 255, 0.06) inset;
    overflow: hidden;
    cursor: pointer;
    transform: translateY(-130%) scale(0.9);
    opacity: 0;
    transition:
      width 0.52s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.52s cubic-bezier(0.22, 1, 0.36, 1),
      border-radius 0.52s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.52s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.28s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .mgx-notif[data-open="true"] {
    width: min(calc(100vw - 32px), 396px);
    height: 74px;
    border-radius: 37px;
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  .mgx-notif[data-open="false"] { opacity: 0.001; }
  /* The droplet that trails the island as it stretches. */
  .mgx-notif__droplet {
    position: absolute; inset-inline-start: 50%; top: 100%;
    width: 22px; height: 22px; margin-inline-start: -11px; margin-top: -14px;
    border-radius: 999px; background: #0a0b10;
    opacity: 0; transform: scale(0.4);
    transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .mgx-notif[data-open="true"] .mgx-notif__droplet { opacity: 1; transform: scale(1); }
  .mgx-notif__body {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 12px;
    padding: 0 16px;
    opacity: 0; translate: 0 6px;
    transition: opacity 0.3s ease 0.12s, translate 0.42s cubic-bezier(0.22, 1, 0.36, 1) 0.12s;
  }
  .mgx-notif[data-open="true"] .mgx-notif__body { opacity: 1; translate: 0 0; }
  .mgx-notif__lead {
    flex: none; width: 40px; height: 40px; border-radius: 50%;
    display: grid; place-items: center; overflow: hidden;
    background: rgba(255, 255, 255, 0.08);
  }
  .mgx-notif__lead img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .mgx-notif__text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
  .mgx-notif__title {
    font-size: 14.5px; font-weight: 650; letter-spacing: -0.01em; line-height: 1.25;
    color: var(--mgx-accent);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .mgx-notif__message {
    font-size: 12.5px; line-height: 1.35; color: rgba(245, 245, 247, 0.66);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .mgx-notif__symbol { flex: none; display: grid; place-items: center; color: rgba(245, 245, 247, 0.8); }
  @media (prefers-reduced-motion: reduce) {
    .mgx-notif, .mgx-notif__body, .mgx-notif__droplet { transition-duration: 0.01ms !important; }
  }
`;

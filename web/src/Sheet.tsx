import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Check, X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom-anchored sheet on mobile, centered dialog above 760px. Handles the four things
 * the old `.modal` did not: body scroll lock, focus trap, focus return to the trigger,
 * and swipe-down to dismiss. Escape and a scrim tap also close.
 */
export function Sheet({
  open,
  onClose,
  title,
  meta,
  lead,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  meta?: ReactNode;
  /** Optional mark before the title — a player headshot, a team avatar. Decorative. */
  lead?: ReactNode;
  children: ReactNode;
  labelledBy?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<Element | null>(null);
  const dragFrom = useRef<number | null>(null);
  const dragBy = useRef(0);

  // Remember what opened us so focus can go back there on close.
  useEffect(() => {
    if (open) trigger.current = document.activeElement;
  }, [open]);

  // Scroll-lock the page behind. `overflow:hidden` on body is not enough — the viewport
  // keeps whatever scroll range the clipped body still has — so freeze it with position:fixed
  // and restore the offset on close. Padding compensates for the desktop scrollbar.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const y = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      Object.assign(body.style, prev);
      window.scrollTo(0, y);
    };
  }, [open]);

  const close = useCallback(() => {
    onClose();
    const t = trigger.current;
    if (t instanceof HTMLElement && document.contains(t)) t.focus();
  }, [onClose]);

  // Escape closes; Tab cycles inside the sheet only.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  // Move focus into the sheet once it mounts.
  useEffect(() => {
    if (!open || !panel.current) return;
    const first = panel.current.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current).focus();
  }, [open]);

  if (!open) return null;

  // Swipe down past a third of the sheet dismisses it; anything less springs back. The
  // transform is written straight to the node so a drag costs no renders.
  const onTouchStart = (e: React.TouchEvent) => {
    dragFrom.current = e.touches[0]!.clientY;
    dragBy.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragFrom.current == null) return;
    dragBy.current = Math.max(0, e.touches[0]!.clientY - dragFrom.current);
    panel.current?.style.setProperty("transform", `translateY(${dragBy.current}px)`);
  };
  const onTouchEnd = () => {
    const h = panel.current?.getBoundingClientRect().height ?? 0;
    panel.current?.style.removeProperty("transform");
    if (dragBy.current > Math.max(80, h / 3)) close();
    dragBy.current = 0;
    dragFrom.current = null;
  };

  return (
    <div className="sheet-scrim" onClick={close}>
      <div
        className="sheet"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span />
        </div>
        <div className="sheet-head" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {lead}
          <div className="sheet-title-block">
            <div className="sheet-title" id={labelledBy}>
              {title}
            </div>
            {meta && <div className="sheet-meta">{meta}</div>}
          </div>
          <button className="btn btn-icon" onClick={close} aria-label="Close">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** A picker sheet: one 44px row per option, current selection checked. */
export function PickerSheet<T extends string | number>({
  open,
  onClose,
  title,
  options,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: { value: T; label: string }[];
  value: T | null;
  onPick: (v: T) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} labelledBy="picker-title">
      <div className="picker" role="listbox" aria-label={title}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="option"
            aria-selected={o.value === value}
            className={"picker-row" + (o.value === value ? " is-on" : "")}
            onClick={() => {
              onPick(o.value);
              onClose();
            }}
          >
            <span className="picker-label">{o.label}</span>
            {o.value === value && <Check size={20} strokeWidth={2} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

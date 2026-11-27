import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { scrollEdges, setRowFadeMask, type ScrollEdges } from '../lib/setRow';

interface LiveSetRowScrollerProps {
  /** Changes whenever another set is opened (or none): scroll it into view if it is out of sight. */
  openedKey: string | number;
  /** Changes with the number of dots: re-measure the overflow. */
  count: number;
  /** Extra classes on the scroller (vertical margins). */
  className?: string;
  /** Classes on the content track (layout of the dots). */
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  children: ReactNode;
}

/** Width of the fade bands of the mask (`#000 76px`, `calc(100% - 22px)`). */
const FADE_LEFT = 76;
const FADE_RIGHT = 22;

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * DESIGN §4 "Schuifbare set-rij", shared by the normal and the zigzag set row.
 * Scrolls horizontally without a visible scrollbar and starts right-aligned
 * (`direction: rtl` on the scroller, `ltr` on the content) so the last sets and
 * the plus dot are in view. An edge fades out only while it hides something
 * (§12 q15, measured on scroll and resize, never computed from the layout).
 * Opening a set that is out of sight (or under a fade) scrolls it to the
 * centre (§12 q16), instantly on the first render and with reduced motion.
 * Remount per exercise (`key`) so each exercise starts right-aligned.
 */
export function LiveSetRowScroller({
  openedKey,
  count,
  className,
  contentClassName,
  contentStyle,
  children,
}: LiveSetRowScrollerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);
  /** A smooth scroll towards an earlier opened set may still be running. */
  const gliding = useRef(false);
  const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const next = scrollEdges(el);
      setEdges(prev => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
      if (contentRef.current) ro.observe(contentRef.current);
    }
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [count]);

  useEffect(() => {
    const el = ref.current;
    const target = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !target) return;
    const instant = firstScroll.current || reducedMotion();
    firstScroll.current = false;
    const box = el.getBoundingClientRect();
    const dot = target.getBoundingClientRect();
    // A dot under a fading edge counts as out of sight too.
    const fade = scrollEdges(el);
    const left = box.left + (fade.left ? FADE_LEFT : 0);
    const right = box.right - (fade.right ? FADE_RIGHT : 0);
    if (dot.left >= left - 1 && dot.right <= right + 1) {
      // In sight now: stop a glide towards a set opened a moment ago (e.g. the
      // active set shown for a moment while an added set is still being stored).
      if (gliding.current && typeof el.scrollTo === 'function') el.scrollTo({ left: el.scrollLeft, behavior: 'auto' });
      gliding.current = false;
      return;
    }
    // Centre it (as `scrollIntoView({ inline: 'center', block: 'nearest' })`), but
    // only this scroller moves: the page never jumps. Relative to the current
    // scrollLeft, so it holds for the rtl convention (0 at the right, negative left).
    const delta = dot.left + dot.width / 2 - (box.left + box.width / 2);
    const to = el.scrollLeft + delta;
    gliding.current = !instant;
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: to, behavior: instant ? 'auto' : 'smooth' });
    else el.scrollLeft = to;
  }, [openedKey, count]);

  const mask = setRowFadeMask(edges);
  return (
    <div
      ref={ref}
      dir="rtl"
      className={cn('scrollbar-none overflow-x-auto overflow-y-hidden overscroll-x-contain', className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div
        ref={contentRef}
        dir="ltr"
        className={cn('box-border w-max min-w-full pr-[22px]', contentClassName)}
        style={contentStyle}
      >
        {children}
      </div>
    </div>
  );
}

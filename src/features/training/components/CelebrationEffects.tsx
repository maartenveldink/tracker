import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { confettiPieces, type ConfettiColor, type ConfettiShape } from '../lib/celebration';

/** True when the user has requested reduced motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const COLOR_VAR: Record<ConfettiColor, string> = {
  accent: 'var(--color-accent)',
  'accent-2': 'var(--color-accent-2)',
  text: 'var(--color-text)',
  coral: 'var(--color-confetti-coral)',
  amber: 'var(--color-confetti-amber)',
};

const SHAPE_STYLE: Record<ConfettiShape, (size: number) => CSSProperties> = {
  rect: size => ({ width: size, height: size * 0.6 }),
  circle: size => ({ width: size, height: size, borderRadius: '9999px' }),
  triangle: size => ({
    width: size,
    height: size,
    clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
  }),
};

// Three bursts of 12 rays (DESIGN §8): positions are from the top-left of the screen.
const BURSTS = [
  { x: 60, y: 110, delay: 0.1, colors: ['var(--color-text)', 'var(--color-accent)'] },
  { x: 332, y: 150, delay: 0.35, colors: ['var(--color-accent-2)', 'var(--color-confetti-amber)'] },
  { x: 200, y: 56, delay: 0.6, colors: ['var(--color-text)', 'var(--color-accent)'] },
];

const DURATION_MS = 4500;

/**
 * Confetti + fireworks overlay for the "Oefening klaar" moment. Mounts only
 * while `play` is true for ~4.5 s; purely decorative (aria-hidden,
 * pointer-events none). Renders nothing under reduced motion.
 */
export function CelebrationEffects({ play }: { play: boolean }) {
  const [visible, setVisible] = useState(false);
  const pieces = useMemo(() => confettiPieces(40), []);

  useEffect(() => {
    if (!play || prefersReducedMotion()) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), DURATION_MS + 300);
    return () => clearTimeout(t);
  }, [play]);

  if (!visible) return null;

  return (
    <div
      data-testid="celebration"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {/* Confetti starts from the middle of the banner (approx. upper third) */}
      <div className="absolute left-1/2 top-[30%]">
        {pieces.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          return (
            <span
              key={i}
              className="absolute animate-confetti opacity-0"
              style={{
                ...SHAPE_STYLE[p.shape](p.size),
                background: COLOR_VAR[p.color],
                '--cx': `${Math.round(Math.cos(rad) * p.distance)}px`,
                '--cy': `${Math.round(Math.sin(rad) * p.distance)}px`,
                '--cr': `${p.spin}deg`,
                animationDuration: `${DURATION_MS}ms`,
                animationDelay: `${p.delay}s`,
                animationFillMode: 'both',
              } as CSSProperties}
            />
          );
        })}
      </div>
      {BURSTS.map((b, bi) =>
        Array.from({ length: 12 }, (_, i) => (
          <span
            key={`${bi}-${i}`}
            className="absolute h-[3px] w-4 origin-left animate-firework-ray rounded-full opacity-0"
            style={{
              left: b.x,
              top: b.y,
              background: b.colors[i % 2],
              '--fa': `${i * 30}deg`,
              animationDuration: '3.2s',
              animationDelay: `${b.delay}s`,
              animationFillMode: 'both',
              animationTimingFunction: 'ease-out',
            } as CSSProperties}
          />
        )),
      )}
    </div>
  );
}

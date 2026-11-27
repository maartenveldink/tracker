import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig';
import { describe, expect, it } from 'vitest';

/**
 * Guard: every `animate-*` class used in a component must exist as a Tailwind
 * utility. A keyframe without an `animation` entry generates no class, so the
 * element silently never animates (the "Oefening klaar" confetti stayed at
 * opacity 0 that way while the overlay was in the DOM).
 */
const SRC = join(__dirname, '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  );
}

describe('animation utilities', () => {
  it('generates a CSS rule for every animate-* class used in src', async () => {
    const files = tsxFiles(SRC);
    const used = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\banimate-[a-z0-9-]+/g)) used.add(m[0]);
    }
    expect(used).toContain('animate-confetti');
    expect(used).toContain('animate-firework-ray');

    // Loaded like the real build does (jiti), so the config's require() works.
    const config = loadConfig(join(SRC, '..', 'tailwind.config.js'));
    const result = await postcss([
      tailwindcss({ ...config, content: [{ raw: [...used].join(' '), extension: 'html' }] }),
    ]).process('@tailwind utilities;', { from: undefined });

    const missing = [...used].filter(c => !result.css.includes(`.${c} {`) && !result.css.includes(`.${c}{`));
    expect(missing).toEqual([]);
  });
});

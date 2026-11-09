const token = name =>
  `color-mix(in srgb, var(--color-${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Single source of truth: src/styles/tokens.css. Colours resolve through
      // color-mix so opacity modifiers (bg-accent/50) keep working.
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        text: token('text'),
        muted: { DEFAULT: token('muted'), foreground: token('muted') },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('on-accent'),
          2: token('accent-2'),
        },
        'on-accent': token('on-accent'),
        overlay: token('overlay'),
        // Legacy shadcn names, mapped onto the tokens so existing screens are themed.
        border: token('line'),
        input: token('line-strong'),
        ring: token('accent'),
        background: token('bg'),
        foreground: token('text'),
        primary: { DEFAULT: token('accent'), foreground: token('on-accent') },
        secondary: { DEFAULT: token('line'), foreground: token('text') },
        destructive: { DEFAULT: '#c2410c', foreground: token('text') },
        card: { DEFAULT: token('surface'), foreground: token('text') },
        popover: { DEFAULT: token('surface'), foreground: token('text') },
      },
      borderColor: { DEFAULT: token('line') },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
      },
      fontSize: {
        caption: 'var(--text-caption)',
        nav: 'var(--text-nav)',
        small: 'var(--text-small)',
        body: 'var(--text-body)',
        'body-lg': 'var(--text-body-lg)',
        title: 'var(--text-title)',
        stat: 'var(--text-stat)',
        screen: 'var(--text-screen)',
        hero: 'var(--text-hero)',
        big: 'var(--text-big)',
        stepper: 'var(--text-stepper)',
      },
      spacing: {
        touch: 'var(--size-touch)',
        button: 'var(--size-button)',
        'button-train': 'var(--size-button-train)',
        nav: 'var(--size-nav)',
        'screen-x': 'var(--space-screen-x)',
        'screen-top': 'var(--space-screen-top)',
        gap: 'var(--space-gap)',
        'gap-tight': 'var(--space-gap-tight)',
        card: 'var(--space-card)',
      },
      borderRadius: {
        chip: 'var(--radius-chip)',
        row: 'var(--radius-row)',
        button: 'var(--radius-button)',
        tile: 'var(--radius-tile)',
        card: 'var(--radius-card)',
        sheet: 'var(--radius-sheet)',
        pill: 'var(--radius-pill)',
      },
      maxWidth: { column: '560px' },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        celebrate: {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '40%': { transform: 'scale(1.15)', opacity: '1' },
          '70%': { transform: 'scale(0.95)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // WP5: two-phase confetti (burst out, then fall + fade). Per-piece
        // --cx/--cy (burst offset), --cr (spin) are set inline.
        confetti: {
          '0%': { transform: 'translate(0,0) rotate(0deg)', opacity: '1', animationTimingFunction: 'ease-out' },
          '22%': { transform: 'translate(var(--cx),var(--cy)) rotate(var(--cr))', opacity: '1', animationTimingFunction: 'ease-in' },
          '68%': { opacity: '1' },
          '76%': { transform: 'translate(calc(var(--cx) * 1.15),620px) rotate(calc(var(--cr) * 2))', opacity: '0' },
          '100%': { transform: 'translate(calc(var(--cx) * 1.15),620px) rotate(calc(var(--cr) * 2))', opacity: '0' },
        },
        // Firework ray: --fa is the ray angle.
        'firework-ray': {
          '0%': { transform: 'rotate(var(--fa)) translateX(4px) scaleX(1)', opacity: '1' },
          '100%': { transform: 'rotate(var(--fa)) translateX(60px) scaleX(0.2)', opacity: '0' },
        },
        'banner-pop': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'moment-fade': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'float-up': {
          '0%': { transform: 'translateY(8px) scale(0.8)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'translateY(-28px) scale(1.1)', opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        celebrate: 'celebrate 0.6s ease-out both',
        'float-up': 'float-up 1.4s ease-out forwards',
        'banner-pop': 'banner-pop var(--motion-pop) both',
        'moment-fade': 'moment-fade var(--motion-row) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

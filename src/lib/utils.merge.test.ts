import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn with design tokens', () => {
  it('keeps a text colour next to a token font size', () => {
    expect(cn('text-primary-foreground', 'text-body-lg')).toContain('text-primary-foreground');
  });
  it('lets a caller override a token height', () => {
    expect(cn('h-touch', 'h-9')).toBe('h-9');
  });
});

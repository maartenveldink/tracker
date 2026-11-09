import { test, expect } from '../fixtures/app';

/**
 * Small accessibility smoke checks (DESIGN §11, WP8): touch targets and the
 * wide-screen column. Deliberately narrow: they assert things the redesign
 * promised, not a full audit.
 */
test.describe('Accessibility', () => {
  test('progress tabs and calendar month buttons are at least 44px', async ({ progress, page }) => {
    await progress.goto();
    for (const name of ['Oefeningen', 'Overzicht', 'Gewicht']) {
      const tab = page.getByRole('tab', { name, exact: true });
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    }
    await progress.openTab('Overzicht');
    for (const name of ['Vorige maand', 'Volgende maand']) {
      const button = page.getByRole('button', { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('on a wide screen the bottom navigation stays in the 560px column', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const links = page.getByRole('navigation', { name: 'Hoofdnavigatie' }).getByRole('link');
    await expect(links.first()).toBeVisible();
    const first = await links.first().boundingBox();
    const last = await links.last().boundingBox();
    const span = (last!.x + last!.width) - first!.x;
    expect(span).toBeLessThanOrEqual(560.5);
    expect(first!.x).toBeGreaterThanOrEqual((1280 - 560) / 2 - 1);
  });
});

import { expect, test } from '@playwright/test';

const source = [
  '--!strict',
  'export type Config<T> = { value: T, enabled: boolean }',
  '--[=[ A long comment',
  'still a comment ]=]',
  'local amount: number = 0b1010_0101 + 0xFF',
  'local text = [==[literal {notExpression}]==]',
  'local message = `Total: {amount + 1}`',
  'if amount > 0 then',
  '\tprint(message)',
  'end',
].join('\n');

for (const theme of ['light', 'dark']) {
  test(`Luau syntax stays colored and aligned in ${theme} create and edit pages`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('rolink-theme', value), theme);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let body: unknown = {};
      if (path === '/api/auth/session') body = { user: { id: 'test-user', name: 'Creator' }, expires: '2099-01-01T00:00:00Z' };
      if (path === '/api/site-banners') body = { banners: [] };
      if (path === '/api/custom-dashboard/resolve') body = { isCustomDashboard: false };
      if (path === '/api/dashboard/creator/modules') body = { modules: [{
        id: 'syntax-module', name: 'Luau syntax', slug: 'luau-syntax', version: '1.0.0', category: 'General',
        description: 'Syntax fixture', status: 'DRAFT', sourceCode: source, configSchema: {},
      }] };
      await route.fulfill({ json: body });
    });
    for (const mode of ['new', 'syntax-module/edit']) {
      await page.goto(`/dashboard/creator/modules/${mode}`);
      const editor = page.getByLabel('Module source code');
      if (mode === 'new') {
        await page.getByLabel('Upload Source').setInputFiles({ name: 'syntax.luau', mimeType: 'text/plain', buffer: Buffer.from(source) });
      }
      await expect(editor).toHaveValue(source);
      const mirror = page.locator('[data-luau-highlight]');
      await expect.poll(() => mirror.textContent()).toBe(source + '\n');
      const keyword = mirror.locator('[data-luau-token]').filter({ hasText: /^local$/ }).first();
      await expect(keyword).toBeAttached();
      const keywordColor = await keyword.evaluate(el => getComputedStyle(el).color);
      expect(keywordColor).toBe(theme === 'dark' ? 'rgb(249, 117, 131)' : 'rgb(215, 58, 73)');
      const binary = mirror.locator('[data-luau-token]').filter({ hasText: /^0b1010_0101$/ });
      await expect(binary).toHaveCount(1);
      expect(await binary.evaluate(el => getComputedStyle(el).color)).not.toBe(keywordColor);
      const interpolation = await mirror.locator('[data-luau-line]').filter({ hasText: 'Total:' }).locator('[data-luau-token]').evaluateAll(nodes => nodes.map(el => ({ text: el.textContent!.trim(), color: getComputedStyle(el).color })));
      const expression = interpolation.find(token => token.text === 'amount');
      const literal = interpolation.find(token => token.text.startsWith('`Total:'));
      expect(expression).toBeTruthy(); expect(literal).toBeTruthy();
      expect(expression!.color).not.toBe(literal!.color);
      const layout = await editor.evaluate(el => {
        const mirror = el.parentElement!.querySelector('pre')!;
        const styles = (node: Element) => { const css = getComputedStyle(node); return [css.fontFamily, css.fontSize, css.lineHeight, css.letterSpacing, css.tabSize, css.padding]; };
        return { input: styles(el), mirror: styles(mirror), code: styles(mirror.querySelector('code')!).slice(0, 3), transparent: getComputedStyle(el).color };
      });
      expect(layout.input).toEqual(layout.mirror);
      expect(layout.code).toEqual(layout.input.slice(0, 3));
      expect(layout.transparent).toBe('rgba(0, 0, 0, 0)');
      await editor.scrollIntoViewIfNeeded();
      await page.locator('[data-luau-editor]').screenshot({ path: test.info().outputPath(`luau-${theme}-${mode === 'new' ? 'create' : 'edit'}.png`) });
      const longSource = source + '\n' + '-- long line ' + 'x'.repeat(200) + '\n' + 'print(amount)\n'.repeat(60);
      await editor.fill(longSource);
      await expect.poll(() => mirror.textContent()).toBe(longSource + '\n');
      await editor.evaluate(el => { el.scrollTop = 200; el.scrollLeft = 100; el.dispatchEvent(new Event('scroll')); });
      await expect.poll(() => mirror.evaluate(el => [el.scrollTop, el.scrollLeft])).toEqual([200, 100]);
      const toggle = page.getByRole('button', { name: /Switch to .* mode/ });
      await toggle.click();
      await expect(keyword).toHaveCSS('color', theme === 'dark' ? 'rgb(215, 58, 73)' : 'rgb(249, 117, 131)');
      await toggle.click();
      await expect(editor).toHaveValue(longSource);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

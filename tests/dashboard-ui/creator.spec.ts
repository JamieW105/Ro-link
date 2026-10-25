import { expect, test, type Locator } from '@playwright/test';

async function expectColor(locator: Locator, property: 'backgroundColor' | 'color', expected: string) {
  const colors = await locator.evaluate((element, { property, expected }) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const pixel = (color: string) => {
      context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    return { actual: pixel(getComputedStyle(element)[property]), expected: pixel(expected) };
  }, { property, expected });
  expect(colors.actual).toEqual(colors.expected);
}

const addon = {
  id: 'creator-module', slug: 'creator-tools', name: 'Creator tools', description: 'Tools for a community.',
  version: '1.0.0', category: 'General', status: 'DRAFT', isOfficial: false, creatorIsVerified: true,
  sourceCode: 'return {}', sourceChecksum: 'fixture-checksum', configSchema: {
    message: { key: 'message', label: 'Welcome message', type: 'string' },
  }, updatedAt: null, submittedAt: null, reviewedAt: null, publishedAt: null,
};

for (const theme of ['light', 'dark']) {
  test(`creator dashboard ${theme} supports editing, terms and themed confirmations`, async ({ page }) => {
    test.setTimeout(120_000);
    const writes: { method: string; body: unknown }[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('rolink-theme', value), theme);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let body: unknown = {};
      if (path === '/api/auth/session') body = { user: { id: 'test-user', name: 'Creator' }, expires: '2099-01-01T00:00:00Z' };
      if (path === '/api/site-banners') body = { banners: [] };
      if (path === '/api/custom-dashboard/resolve') body = { isCustomDashboard: false };
      if (path === '/api/dashboard/creator/modules') body = { modules: [addon] };
      if (path === '/api/dashboard/creator/modules/creator-module') {
        const payload = route.request().postDataJSON();
        writes.push({ method: route.request().method(), body: payload });
        body = { module: { ...addon, ...payload } };
      }
      await route.fulfill({ json: body });
    });
    await page.goto('/dashboard/creator/modules');
    await expect(page.getByRole('heading', { name: 'Creator Dashboard', exact: true })).toBeVisible();
    await expect(page.locator('[data-slot="stat"]')).toHaveCount(4);
    await expect(page.locator('form')).toHaveCount(0);
    const moduleLink = page.getByRole('link', { name: `Edit ${addon.name}`, exact: true });
    await expect(moduleLink).toHaveAttribute('href', '/dashboard/creator/modules/creator-module/edit');
    const moduleCard = moduleLink.locator('xpath=ancestor::section');
    const bounds = await moduleCard.boundingBox();
    const main = await page.locator('main').boundingBox();
    expect(bounds!.width).toBeGreaterThan(main!.width * 0.8);
    await page.getByRole('button', { name: 'Published', exact: true }).click();
    await expect(page.getByText('No modules match this view.')).toBeVisible();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByLabel('Search creator modules').fill('missing module');
    await expect(page.getByText('No modules match this view.')).toBeVisible();
    await page.getByLabel('Search creator modules').fill('');
    await page.screenshot({ path: test.info().outputPath(`creator-list-${theme}.png`), fullPage: true });
    await moduleLink.click();
    await expect(page).toHaveURL(/\/creator\/modules\/creator-module\/edit$/);
    await expect(page.getByRole('heading', { name: 'Edit Module', exact: true })).toBeVisible();
    await expect(page.getByLabel('Search creator modules')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(addon.name);
    await expect(page.getByLabel('Module source code')).toHaveValue(addon.sourceCode);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const card = page.locator('form [data-slot="card"]').first();
    const background = theme === 'dark' ? 'oklch(0.205 0 0)' : 'oklch(1 0 0)';
    await expectColor(card, 'backgroundColor', background);
    await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', theme);
    const submit = page.getByRole('button', { name: 'Submit Review', exact: true });
    await expectColor(submit, 'backgroundColor', theme === 'dark' ? 'oklch(0.922 0 0)' : 'oklch(0.205 0 0)');
    await expectColor(card, 'color', theme === 'dark' ? 'oklch(0.985 0 0)' : 'oklch(0.145 0 0)');
    const toggle = page.getByRole('button', { name: /Switch to .* mode/ });
    await toggle.click(); await toggle.click();
    expect(await page.evaluate(() => localStorage.getItem('rolink-theme'))).toBe(theme);
    await page.screenshot({ path: test.info().outputPath(`creator-${theme}.png`), fullPage: true });
    const category = page.getByRole('combobox', { name: 'Category', exact: true });
    await expect(category).toHaveValue('General');
    await category.fill('Moderation');
    await page.getByRole('option', { name: 'Moderation', exact: true }).click();
    await expect(category).toHaveValue('Moderation');
    await page.getByRole('button', { name: 'Submit Review', exact: true }).click();
    await expect(page.locator('main').getByRole('alert')).toContainText('accept both module terms');
    const checks = page.getByRole('checkbox');
    await checks.nth(0).focus(); await page.keyboard.press('Space');
    await checks.nth(1).focus(); await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Submit Review', exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({ method: 'PATCH', body: { ...Object.fromEntries(['name', 'slug', 'description', 'version', 'category', 'sourceCode'].map(key => [key, addon[key as keyof typeof addon]])), category: 'Moderation', status: 'PENDING_REVIEW' } });
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectColor(dialog, 'backgroundColor', background);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(writes).toHaveLength(1);
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await dialog.getByRole('button', { name: 'Archive module', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(writes[1]).toEqual({ method: 'PATCH', body: { status: 'ARCHIVED' } });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(writes).toHaveLength(2);
    await page.getByRole('link', { name: 'Back to My Modules', exact: true }).click();
    await expect(page).toHaveURL(/\/creator\/modules$/);
    await expect(page.locator('form')).toHaveCount(0);
    await page.getByRole('link', { name: 'New Module', exact: true }).click();
    await expect(page).toHaveURL(/\/creator\/modules\/new$/);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Module source code')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
    await page.goto('/dashboard/creator/modules/unavailable-module/edit');
    await expect(page.getByRole('heading', { name: 'Module not found', exact: true })).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
    expect(writes).toHaveLength(2);
    expect(errors).toEqual([]);
  });
}

test('creator new module uploads, saves to its edit URL, and returns to the library after deletion', async ({ page }) => {
  test.setTimeout(120_000);
  let saved: Record<string, unknown> | null = null;
  const writes: { method: string; body: unknown }[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let body: unknown = {};
    if (path === '/api/auth/session') body = { user: { id: 'test-user', name: 'Creator' }, expires: '2099-01-01T00:00:00Z' };
    if (path === '/api/site-banners') body = { banners: [] };
    if (path === '/api/custom-dashboard/resolve') body = { isCustomDashboard: false };
    if (path === '/api/dashboard/creator/modules') {
      if (method === 'POST') {
        const payload = route.request().postDataJSON();
        writes.push({ method, body: payload });
        saved = { ...addon, ...payload };
        body = { module: saved };
      } else body = { modules: saved ? [saved] : [] };
    }
    if (path === '/api/dashboard/creator/modules/creator-module' && method === 'DELETE') {
      writes.push({ method, body: null }); saved = null;
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/dashboard/creator/modules');
  await expect(page.getByText('No modules yet.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'New Module', exact: true }).click();
  await page.getByLabel('Upload Source').setInputFiles({ name: 'Uploaded tools.luau', mimeType: 'text/plain', buffer: Buffer.from('return { uploaded = true }') });
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Uploaded tools');
  await page.getByLabel('Description', { exact: true }).fill('An uploaded draft.');
  const category = page.getByRole('combobox', { name: 'Category', exact: true });
  await category.fill('Community');
  await category.press('ArrowDown');
  await category.press('Enter');
  await expect(category).toHaveValue('Community');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page).toHaveURL(/\/creator\/modules\/creator-module\/edit$/);
  await expect(page.getByLabel('Module source code')).toHaveValue('return { uploaded = true }');
  expect(writes[0]).toMatchObject({ method: 'POST', body: { name: 'Uploaded tools', category: 'Community', sourceCode: 'return { uploaded = true }', status: 'DRAFT' } });
  await page.reload();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Uploaded tools');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete module', exact: true }).click();
  await expect(page).toHaveURL(/\/creator\/modules$/);
  await expect(page.getByText('No modules yet.', { exact: true })).toBeVisible();
  expect(writes[1]).toEqual({ method: 'DELETE', body: null });
});

test('module category dropdown preserves legacy values and is shared with marketplace creation', async ({ page }) => {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === '/api/auth/session') body = { user: { id: 'test-user', name: 'Creator' }, expires: '2099-01-01T00:00:00Z' };
    if (path === '/api/site-banners') body = { banners: [] };
    if (path === '/api/custom-dashboard/resolve') body = { isCustomDashboard: false };
    if (path === '/api/dashboard/creator/modules') body = { modules: [{ ...addon, category: 'Legacy Custom' }] };
    await route.fulfill({ json: body });
  });
  await page.goto('/dashboard/creator/modules/creator-module/edit');
  const category = page.getByRole('combobox', { name: 'Category', exact: true });
  await expect(category).toHaveValue('Legacy Custom');
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} mode` });
    if (await toggle.count()) await toggle.click();
    await page.getByRole('button', { name: 'Show category options', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Legacy Custom', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'General', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`category-${theme}.png`), fullPage: true });
    await page.keyboard.press('Escape');
  }
  await page.goto('/dashboard/marketplace/create');
  await expect(category).toHaveValue('General');
  await category.fill('Utilities');
  await category.press('ArrowDown');
  await category.press('Enter');
  await expect(category).toHaveValue('Utilities');
});

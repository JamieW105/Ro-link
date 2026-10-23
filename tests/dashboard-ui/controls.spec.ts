import { expect, test, type Page } from "@playwright/test";

const serverId = "123456789012345678";
const guild = { id: serverId, name: "UI Test Server", icon: null, permissions: "8", owner: true, hasBot: true };
const roles = [{ id: "role-1", name: "Verified Members", color: 0 }, { id: "role-2", name: "Moderators", color: 0 }];

const sampleModule = {
  id: 'module-welcome', slug: 'welcome-tools', name: 'Welcome tools',
  description: 'Welcome new players and keep your community connected with configurable join messages.',
  version: '1.0.0', category: 'Community', status: 'PUBLISHED', isOfficial: true,
  creatorIsVerified: true, creatorApprovedModuleCount: 1, creatorMaxModuleInstallCount: 10,
  sourceChecksum: 'fixture-checksum', configSchema: { message: { key: 'message', label: 'Welcome message', shortDescription: 'The message shown when players join.', type: 'string', options: [], defaultValue: 'Welcome!' } },
  authorDiscordId: 'creator-user', submittedAt: null, reviewedAt: null, moderationNote: '',
  publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const sampleServer = { id: 'live-job-001', server_id: serverId, player_count: 2, players: [], updated_at: '2026-10-23T00:00:00Z' };

async function mockDashboard(page: Page, themed = false) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (pathname === "/api/auth/session") body = { user: { id: "test-user", name: "UI Tester", image: null }, expires: "2099-01-01T00:00:00Z" };
    else if (pathname === "/api/guilds") body = [guild];
    else if (pathname === "/api/user/permissions") body = { is_admin: true, can_access_dashboard: true, can_access_live_panel: true, allowed_misc_cmds: [] };
    else if (pathname === `/api/guilds/${serverId}/roles` || pathname === "/api/discord/roles") body = roles;
    else if (pathname === "/api/discord/channels") body = [{ id: "channel-1", name: "audit-logs" }];
    else if (pathname === "/api/dashboard/server-config") body = { verification_enabled: true, verified_role: "role-1", on_join_role: "", block_unverified: false, api_key: "test-key", admin_cmds_enabled: true, misc_cmds_enabled: true };
    else if (pathname === "/api/custom-dashboard/resolve") body = { isCustomDashboard: false };
    else if (pathname === `/api/custom-dashboard/${serverId}`) body = { id: serverId, name: guild.name, theme: themed ? "violet" : "sky", subdomain: themed ? "ui-test" : undefined };
    else if (pathname === "/api/dashboard/custom-dashboard") body = { configured: themed, dashboard: themed ? { server_id: serverId, name: guild.name, theme: "violet", layout: "standard", enabled: true } : null };
    else if (pathname === "/api/settings/roles") body = [{ id: "configured-role", discord_role_id: "role-2", role_name: "Moderators", can_access_dashboard: true, can_kick: false, allowed_misc_cmds: [] }];
    else if (pathname === "/api/site-banners") body = { banners: [] };
    else if (pathname === "/api/ping") body = { ok: true };
    else if (pathname === "/api/dashboard/marketplace") body = { modules: [sampleModule], installTargets: [{ ...guild, installedModuleCount: 0, moduleLimit: 5 }] };
    else if (pathname === "/api/dashboard/live-panel") body = { server: { placeId: '1234' }, liveServers: [sampleServer], playerActivity: [], modulePanelCommands: [], logs: [], pendingReports: [] };
    else if (pathname === "/api/dashboard/live-servers") body = [sampleServer];
    else if (pathname === "/api/dashboard/modules") body = { modules: [], installedCount: 0 };
    else if (pathname === "/api/dashboard/live-servers" || pathname === "/api/reports" || pathname === "/api/dashboard/logs") body = [];
    await route.fulfill({ json: body });
  });
  return errors;
}

test("create module header aligns with the form in both themes", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto('/dashboard/marketplace/create');
  const heading = page.getByRole('heading', { name: 'Create Module', exact: true });
  await expect(heading).toBeVisible();
  // Catch accidental form submissions from the theme toggle, even with invalid fields.
  await page.locator('form').evaluate((form) => {
    form.addEventListener('submit', (event) => { event.preventDefault(); form.dataset.submitted = 'true'; });
    form.addEventListener('invalid', () => { form.dataset.invalid = 'true'; }, true);
  });
  for (const theme of ['light', 'dark'] as const) {
    await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', theme);
    const navigation = await page.getByRole('navigation', { name: 'Module navigation' }).boundingBox();
    const title = await heading.boundingBox();
    const panel = await page.locator('form section').first().boundingBox();
    const submit = await page.getByRole('button', { name: 'Submit for Moderation', exact: true }).boundingBox();
    const toggle = page.getByRole('button', { name: /Switch to .* mode/ });
    const toggleBox = await toggle.boundingBox();
    expect(navigation && title && panel && submit && toggleBox).toBeTruthy();
    expect(Math.abs(title!.x - panel!.x)).toBeLessThan(1);
    expect(Math.abs(navigation!.x - title!.x)).toBeLessThan(1);
    expect(toggleBox!.y + toggleBox!.height).toBeLessThanOrEqual(title!.y);
    expect(submit!.y + submit!.height).toBeLessThan(panel!.y);
    if (page.viewportSize()!.width >= 768) {
      expect(submit!.x).toBeGreaterThan(title!.x + title!.width);
      expect(Math.abs(submit!.x + submit!.width - panel!.x - (await page.locator('form header').boundingBox())!.width)).toBeLessThan(1);
    } else {
      expect(Math.abs(submit!.x - title!.x)).toBeLessThan(1);
      expect(submit!.y).toBeGreaterThan(title!.y + title!.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (theme === 'light') await toggle.click();
  }
  await expect(page.locator('form')).not.toHaveAttribute('data-submitted', 'true');
  await expect(page.locator('form')).not.toHaveAttribute('data-invalid', 'true');
  expect(errors).toEqual([]);
});


// Check rendered colors, rather than a class/color-scheme that can change while
// old global tokens still paint the page navy.
async function expectPalette(page: Page, theme: "light" | "dark") {
  await expect(page.locator('[data-slot="stat"]').first()).toBeVisible();
  await expect.poll(() => page.evaluate((dark) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    const pixel = (value: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].join(',');
    };
    const shell = getComputedStyle(document.querySelector('.dice-shell')!);
    const card = getComputedStyle(document.querySelector('[data-slot="stat"]')!);
    const primary = getComputedStyle(document.querySelector('a[href$="/live-panel"]:not([aria-label])')!);
    const pairs = {
      background: [shell.backgroundColor, dark ? 'oklch(0.145 0 0)' : 'oklch(1 0 0)'],
      foreground: [shell.color, dark ? 'oklch(0.985 0 0)' : 'oklch(0.145 0 0)'],
      card: [card.backgroundColor, dark ? 'oklch(0.205 0 0)' : 'oklch(1 0 0)'],
      primary: [primary.backgroundColor, dark ? 'oklch(0.922 0 0)' : 'oklch(0.205 0 0)'],
    };
    return Object.fromEntries(Object.entries(pairs).filter(([, [actual, expected]]) => pixel(actual) !== pixel(expected)).map(([key, [actual, expected]]) => [key, {actual, expected}]));
  }, theme === 'dark')).toEqual({});
}

test("overview colors follow the switch despite legacy root colors and survive reload", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  const legacyRoot = `:root { --background: #020617; --foreground: #f8fafc; --dice-card: #0f172a; --dice-foreground: #f8fafc; --dice-primary: #0284c7; --dice-muted: #1e293b; }`;
  await page.goto(`/dashboard/${serverId}`);
  await page.addStyleTag({ content: legacyRoot });
  await expectPalette(page, 'light');
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expectPalette(page, 'dark');
  expect(await page.evaluate(() => localStorage.getItem('rolink-theme'))).toBe('dark');
  await page.reload();
  await page.addStyleTag({ content: legacyRoot });
  await expectPalette(page, 'dark');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expectPalette(page, 'light');
  expect(await page.evaluate(() => localStorage.getItem('rolink-theme'))).toBe('light');
  expect(errors).toEqual([]);
});

test("Dice selectors search, restore selection on Escape, clear and save domain values", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/verification`);
  const verified = page.getByRole("combobox", { name: "Verified role", exact: true });
  await expect(verified).toHaveValue("Verified Members");
  await verified.fill("moder");
  await expect(page.getByRole("option", { name: "Moderators", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Verified Members", exact: true })).toBeHidden();
  await verified.press("ArrowDown");
  await verified.press("Enter");
  await expect(verified).toHaveValue("Moderators");
  await verified.fill("no-match");
  await expect(page.getByText("No options found.", { exact: true })).toBeVisible();
  await verified.press("Escape");
  await expect(verified).toHaveValue("Moderators");
  await verified.fill("None");
  await page.getByRole("option", { name: "None (Disabled)", exact: true }).click();
  await expect(verified).toHaveValue("None (Disabled)");
  const block = page.getByRole("switch", { name: "Block unverified joins" });
  await block.focus();
  await page.keyboard.press("Space");
  await expect(block).toBeChecked();
  const save = page.waitForRequest((request) => request.url().includes("/api/dashboard/server-config") && request.method() === "PATCH");
  await page.getByRole("button", { name: /^save (changes|settings)$/i }).first().click();
  expect((await save).postDataJSON().updates).toMatchObject({ verified_role: "", on_join_role: "", block_unverified: true, verification_enabled: true });
  await page.getByRole("switch", { name: "Roblox verification", exact: true }).click();
  await expect(verified).toBeDisabled();
  await expect(block).toBeDisabled();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("logging selection uses Dice and retains the None value", async ({ page }) => {
  const errors = await mockDashboard(page, true);
  await page.goto(`/dashboard/${serverId}/settings/logging`);
  const logging = page.getByRole("combobox", { name: "Audit logging channel", exact: true });
  await expect(logging).toHaveValue("Disabled (No Logging)");
  await logging.fill("audit");
  const option = page.getByRole("option", { name: "#audit-logs", exact: true });
  await expect(option).toBeVisible();
  // Popup stays inside the shell so custom-theme variables continue to inherit.
  expect(await option.evaluate((node) => Boolean(node.closest(".custom-dashboard-shell")))).toBe(true);
  await option.click();
  await expect(logging).toHaveValue("#audit-logs");
  await logging.fill("Disabled");
  await page.getByRole("option", { name: "Disabled (No Logging)", exact: true }).click();
  await expect(logging).toHaveValue("Disabled (No Logging)");
  expect(errors).toEqual([]);
});

test("dashboard entry uses shared controls", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto("/dashboard");
  await expect(page.getByText(guild.name, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /sign out/i })).toHaveAttribute("data-slot", "button");
  expect(errors).toEqual([]);
});


test("permission checkboxes save boolean permissions through keyboard interaction", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/settings/roles`);
  const kick = page.getByRole("checkbox", { name: "Kick Users", exact: true });
  await expect(kick).not.toBeChecked();
  await kick.focus();
  const saved = page.waitForRequest((request) => request.url().includes("/api/settings/roles") && request.method() === "POST");
  await page.keyboard.press("Space");
  await expect(kick).toBeChecked();
  expect((await saved).postDataJSON()).toMatchObject({ discordRoleId: "role-2", permissions: { kick: true } });
  expect(errors).toEqual([]);
});

test("overview renders Dice metric components", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}`);
  await expect(page.locator('[data-slot="stat"]').first()).toBeVisible();
  await expect(page.locator('[data-slot="stat-value"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});


test("the redesigned light theme carries across modules, marketplace and live panel", async ({ page }) => {
  const errors = await mockDashboard(page);
  for (const path of [`/dashboard/${serverId}/modules`, '/dashboard/marketplace', `/dashboard/${serverId}/live-panel`]) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', 'light');
  }
  expect(errors).toEqual([]);
});

test("mobile navigation opens as a dialog and closes after choosing a page", async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile drawer interaction');
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}`);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dashboard navigation', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Roles', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/${serverId}/settings/roles$`), { timeout: 20_000 });
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Role Permissions', exact: true })).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});


test("theme choice persists across dashboard, Live Panel, marketplace and product pages", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}`);
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  for (const path of [`/dashboard/${serverId}`, `/dashboard/${serverId}/live-panel`, '/dashboard/marketplace', `/dashboard/marketplace/${sampleModule.slug}`]) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', 'dark');
    await expect(page.getByRole('button', { name: 'Switch to light mode', exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: sampleModule.name, exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/dashboard/marketplace/${sampleModule.slug}$`));
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', 'light');
  expect(errors).toEqual([]);
});

test("marketplace search opens a real product page and installs through the existing API", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto('/dashboard/marketplace');
  const search = page.getByRole('textbox', { name: 'Search modules', exact: true });
  await search.fill('no results');
  await expect(page.getByText('No modules found', { exact: true })).toBeVisible();
  await search.fill('welcome');
  await page.getByRole('link', { name: `View ${sampleModule.name}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/marketplace/${sampleModule.slug}$`), { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: sampleModule.name, exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Select Server To Install', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: sampleModule.name, exact: true });
  await expect(dialog).toBeVisible();
  const install = page.waitForRequest(request => request.url().includes('/api/dashboard/modules') && request.method() === 'POST');
  await dialog.getByRole('button', { name: new RegExp(guild.name) }).click();
  expect((await install).postDataJSON()).toMatchObject({ action: 'install', serverId, moduleId: sampleModule.id });
  await expect(dialog.getByText('Installed to 1 server.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.goto(`/dashboard/marketplace?module=${sampleModule.slug}`);
  await expect(page.getByRole('heading', { name: sampleModule.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to marketplace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Module marketplace', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});


test("sidebar omits retired tools while Live Panel remains accessible and retired pages return 404", async ({ page, isMobile }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}`);
  if (isMobile) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const nav = page.getByRole('navigation', { name: isMobile ? 'Mobile dashboard' : 'Dashboard', exact: true });
  await expect(nav).toBeVisible();
  for (const route of ['servers', 'live-panel', 'lookup', 'reports', 'misc']) {
    await expect(nav.locator(`a[href="/dashboard/${serverId}/${route}"]`)).toHaveCount(0);
  }
  await expect(nav.getByRole('link', { name: 'Reports', exact: true })).toHaveAttribute('href', `/dashboard/${serverId}/settings/reports`);
  if (isMobile) await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Open live panel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Live panel', exact: true })).toBeVisible();
  for (const route of ['servers', 'lookup', 'reports', 'reports/report-1', 'misc']) {
    const response = await page.request.get(`/dashboard/${serverId}/${route}`);
    expect(response.status(), `Retired ${route} page`).toBe(404);
  }
  expect(errors).toEqual([]);
});

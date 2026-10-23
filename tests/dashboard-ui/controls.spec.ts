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

const sampleShiftReport = {
  settings: { enabled: true, automatic_start: false, wave_days: 7, quota_hours: 5 },
  wave: { id: 'wave-1', starts_at: '2026-10-19T00:00:00Z', ends_at: '2026-10-26T00:00:00Z', quota_hours: 5 },
  staff: [{ discord_id: 'test-user', roblox_user_id: '1234', username: 'UI Moderator', seconds: 7200, shift_count: 3, wave_seconds: 7200, total_seconds: 14400, total_shifts: 6, active: true, on_break: false }],
  shifts: [{ id: 'shift-1', discord_id: 'test-user', username: 'UI Moderator', started_at: '2026-10-23T00:00:00Z', ended_at: null, last_seen_at: '2026-10-23T02:00:00Z', seconds: 7200, active: true }],
  has_more: true, control: null, current_shift_seconds: 7200,
};

async function mockDashboard(page: Page, themed = false, permissions: Record<string, boolean> = {}, userId = "test-user") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (pathname === "/api/auth/session") body = { user: { id: userId, name: "UI Tester", image: null }, expires: "2099-01-01T00:00:00Z" };
    else if (pathname === "/api/guilds") body = [guild];
    else if (pathname === "/api/user/permissions") body = { is_admin: true, can_access_dashboard: true, can_access_live_panel: true, allowed_misc_cmds: [], ...permissions };
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
    else if (pathname === "/api/dashboard/staff-shifts") body = sampleShiftReport;
    else if (pathname === "/api/dashboard/staff-shifts/settings") body = { ok: true };
    else if (pathname === "/api/dashboard/live-panel") body = { server: { placeId: '1234' }, liveServers: [sampleServer], playerActivity: [], modulePanelCommands: [], logs: [], pendingReports: [] };
    else if (pathname === "/api/dashboard/live-servers") body = [sampleServer];
    else if (pathname === "/api/dashboard/modules") body = { modules: [], installedCount: 0 };
    else if (pathname === "/api/dashboard/live-servers" || pathname === "/api/reports" || pathname === "/api/dashboard/logs") body = [];
    await route.fulfill({ json: body });
  });
  return errors;
}

test("dashboard headers stay slim and fixed across pages and themes", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await mockDashboard(page, false, {}, "953414442060746854");
  for (const path of ['/dashboard', '/dashboard/marketplace', `/dashboard/marketplace/${sampleModule.slug}`, '/dashboard/marketplace/create', '/dashboard/creator/modules', `/dashboard/${serverId}`, `/dashboard/${serverId}/settings/roles`, `/dashboard/${serverId}/staff-shifts`, `/dashboard/${serverId}/staff-shifts/settings`, `/dashboard/${serverId}/live-panel`]) {
    await page.goto(path);
    const header = page.locator('[data-dashboard-header]');
    await expect(header).toBeVisible();
    if (path === "/dashboard" && test.info().project.name === "desktop") {
      await expect(header.getByRole("link", { name: "Management" })).toBeVisible();
      await expect(header.getByRole("button", { name: "Sign Out" })).toBeVisible();
    }
    for (const theme of ['light', 'dark'] as const) {
      const toggle = header.getByRole('button', { name: /Switch to .* mode/ });
      await expect(toggle).toBeEnabled();
      if (await toggle.getAttribute('aria-label') === `Switch to ${theme} mode`) await toggle.click();
      await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', theme);
      await expect(header).toHaveCSS('height', '48px');
      const box = (await header.boundingBox())!;
      expect(box.y).toBe(0);
      for (const control of await header.locator('a:visible, button:visible').all()) {
        const bounds = (await control.boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(box.y);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(box.y + box.height);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      expect((await header.boundingBox())!.y).toBe(0);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }
  expect(errors).toEqual([]);
});

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

test("server invites keep readable text and icons in both themes", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.route("**/api/guilds", (route) => route.fulfill({ json: [{ ...guild, hasBot: false }] }));
  await page.goto("/dashboard");
  const invite = page.getByRole('link', { name: 'Invite', exact: true });
  await expect(invite).toBeVisible();
  await expect(invite).toHaveAttribute('target', '_blank');
  expect(new URL((await invite.getAttribute('href'))!).searchParams.get('guild_id')).toBe(serverId);
  for (const theme of ['light', 'dark'] as const) {
    await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', theme);
    for (const state of ['default', 'hover', 'focus']) {
      if (state === 'hover') await invite.hover();
      if (state === 'focus') {
        await page.mouse.move(0, 0);
        await invite.focus();
      }
      await expect.poll(() => invite.evaluate((node) => {
        const style = getComputedStyle(node);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        const luminance = (color: string) => {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
          const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
            const channel = v / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      })).toBeGreaterThanOrEqual(4.5);
      await expect(invite.locator('svg')).toHaveCSS('color', await invite.evaluate((node) => getComputedStyle(node).color));
    }
    await page.getByRole('button', { name: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`, exact: true }).click();
  }
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

test("role settings use Dice controls for commands and themed removal", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/settings/roles`);
  await expect(page.getByRole("heading", { name: "Discord roles", exact: true })).toBeVisible();
  const kick = page.getByRole("checkbox", { name: "Kick", exact: true });
  const all = page.getByRole("checkbox", { name: "All commands", exact: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(mode => { localStorage.setItem("rolink-theme", mode); }, theme);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await expect(kick).not.toBeChecked();
    const saveOne = page.waitForRequest(request => request.url().includes("/api/settings/roles") && request.method() === "POST");
    await kick.focus();
    await page.keyboard.press("Space");
    expect((await saveOne).postDataJSON().panelCmds).toEqual(["KICK"]);
    await expect(kick).toBeChecked();
    const saveAll = page.waitForRequest(request => request.url().includes("/api/settings/roles") && request.method() === "POST");
    await all.click();
    expect((await saveAll).postDataJSON().panelCmds).toEqual(["*"]);
    await expect(kick).toBeChecked();
    const saveExcept = page.waitForRequest(request => request.url().includes("/api/settings/roles") && request.method() === "POST");
    await kick.click();
    const commands = (await saveExcept).postDataJSON().panelCmds;
    expect(commands.length).toBeGreaterThan(1);
    expect(commands).not.toContain("KICK");
    expect(commands).not.toContain("*");
    await expect(all).not.toBeChecked();
    await page.getByRole("button", { name: "Collapse Moderators" }).click();
    await expect(kick).toBeHidden();
    await page.getByRole("button", { name: "Expand Moderators" }).click();
    await expect(kick).toBeVisible();
    await page.getByRole("button", { name: "Remove Moderators" }).click();
    const dialog = page.getByRole("dialog", { name: "Remove role configuration?" });
    await expect(dialog).toBeVisible();
    const colors = await dialog.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el).color }));
    expect(colors.background).not.toEqual(colors.text);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Moderators", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("main").evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `/workspace/artifacts/dice-${theme}-role-settings-${test.info().project.name}.png` });
    await page.getByRole("heading", { name: "Roblox admin panel commands", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/workspace/artifacts/dice-${theme}-role-commands-${test.info().project.name}.png` });
  }
  await page.getByRole("button", { name: "Remove Moderators" }).click();
  const deleted = page.waitForRequest(request => request.url().includes("/api/settings/roles") && request.method() === "DELETE");
  await page.getByRole("button", { name: "Remove configuration", exact: true }).click();
  expect((await deleted).url()).toContain("id=configured-role");
  await expect(page.getByRole("heading", { name: "No roles configured", exact: true })).toBeVisible();
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


test("staff shifts use Dice controls for reports, history, settings and both themes", async ({ page, isMobile }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}`);
  if (isMobile) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: 'Staff Shifts', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff shifts', exact: true })).toBeVisible({timeout:20000});
  await expect(page.getByText('UI Moderator', { exact: true }).filter({visible:true}).first()).toBeVisible();
  const period = page.getByRole('combobox', { name: 'Time period', exact: true });
  await expect(period).toHaveValue('Latest wave');
  await period.fill('Past week');
  const changedPeriod = page.waitForRequest(request => request.url().includes('/api/dashboard/staff-shifts?') && new URL(request.url()).searchParams.get('period') === 'week');
  await page.getByRole('option', { name: 'Past week', exact: true }).click();
  await changedPeriod;
  await page.getByText('Shift history', { exact: true }).click();
  const nextPage = page.waitForRequest(request => request.url().includes('/api/dashboard/staff-shifts?') && new URL(request.url()).searchParams.get('offset') === '50');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await nextPage;
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(page.locator('.dice-shell')).toHaveCSS('color-scheme', 'dark');
  await page.getByRole('link', { name: 'Shift settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff shift settings', exact: true })).toBeVisible({timeout:20000});
  const automatic = page.getByRole('switch', { name: 'Automatically start shifts', exact: true });
  await expect(automatic).not.toBeChecked();
  await automatic.click();
  await page.getByRole('spinbutton', { name: 'Shift wave length (days)', exact: true }).fill('14');
  await page.getByRole('spinbutton', { name: 'Quota per wave (hours)', exact: true }).fill('8');
  const saved = page.waitForRequest(request => request.url().includes('/api/dashboard/staff-shifts/settings') && request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save shift settings', exact: true }).click();
  expect((await saved).postDataJSON()).toMatchObject({serverId, enabled: true, automatic_start: true, wave_days: 14, quota_hours: 8});
  await expect(page.getByRole('status')).toContainText('Shift settings saved.');
  await expect(page.locator('.dice-shell')).toHaveCSS('color-scheme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('.dice-shell')).toHaveCSS('color-scheme', 'light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("staff shift view and management permissions remain independent", async ({ page }) => {
  const errors = await mockDashboard(page, false, {is_admin: false, can_access_dashboard: false, can_access_live_panel: false, can_view_staff_shifts: true, can_manage_staff_shifts: false});
  await page.goto(`/dashboard/${serverId}/staff-shifts`);
  await expect(page.getByRole('heading', {name:'Staff shifts',exact:true})).toBeVisible();
  await expect(page.getByRole('link', {name:'Shift settings',exact:true})).toHaveCount(0);
  await page.goto(`/dashboard/${serverId}/staff-shifts/settings`);
  await expect(page.getByRole('heading', {name:'Sorry, you do not have access to this dashboard.',exact:true})).toBeVisible();
  await page.route('**/api/user/permissions?*', route => route.fulfill({json:{is_admin:false, can_access_dashboard:false, can_access_live_panel:false, can_view_staff_shifts:false, can_manage_staff_shifts:true}}));
  const settingsOnly = page.waitForRequest(request => request.url().includes('/api/dashboard/staff-shifts?') && new URL(request.url()).searchParams.get('settingsOnly') === 'true');
  await page.goto(`/dashboard/${serverId}/staff-shifts`);
  await settingsOnly;
  await expect(page.getByText('Viewing staff time and history requires', {exact:false})).toBeVisible();
  await expect(page.getByText('UI Moderator', {exact:true})).toHaveCount(0);
  await page.getByRole('link', {name:'Shift settings',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/${serverId}/staff-shifts/settings$`), {timeout:20000});
  await expect(page.getByRole('button', {name:'Save shift settings',exact:true})).toBeVisible({timeout:20000});
  expect(errors).toEqual([]);
});

test("Live Panel retains the personal shift summary and manual shift action", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/live-panel`);
  const personal = page.getByRole('region', {name:'Your staff shifts',exact:true});
  await expect(personal).toBeVisible();
  await expect(personal.getByRole('progressbar', {name:'Progress toward wave quota',exact:true})).toHaveAttribute('aria-valuenow', '40');
  const stopped = page.waitForRequest(request => request.url().includes('/api/dashboard/staff-shifts') && request.method() === 'POST');
  await personal.getByRole('button', {name:'End shift',exact:true}).click();
  expect((await stopped).postDataJSON()).toEqual({serverId, action:'stop'});
  await expect(personal.getByText('4.00 total hours · 6 shifts', {exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test("sidebar account shows the Discord avatar above a compact server switch and falls back on image errors", async ({ page, isMobile }) => {
  const errors = await mockDashboard(page);
  await page.route('**/api/auth/session', route => route.fulfill({json:{user:{id:'test-user',name:'UI Tester',image:'https://cdn.discordapp.com/avatars/test-user/avatar.png'},expires:'2099-01-01T00:00:00Z'}}));
  await page.route('**/api/discord/media?*', route => route.fulfill({path:'public/Media/Ro-LinkIcon.png'}));
  await page.goto(`/dashboard/${serverId}`);
  if (isMobile) await page.getByRole('button', {name:'Open navigation',exact:true}).click();
  const footer = page.locator('[data-slot="sidebar-account"]').filter({visible:true});
  const avatar = footer.getByRole('img', {name:"UI Tester's Discord avatar",exact:true});
  await expect(avatar).toBeVisible();
  const avatarSrc = new URL((await avatar.getAttribute('src'))!, page.url());
  expect(avatarSrc.pathname).toBe('/api/discord/media');
  expect(avatarSrc.searchParams.get('url')).toBe('https://cdn.discordapp.com/avatars/test-user/avatar.png');
  await expect.poll(() => avatar.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  const avatarBox = (await avatar.boundingBox())!;
  const switchBox = (await footer.getByRole('link', {name:'Switch server',exact:true}).boundingBox())!;
  expect(switchBox.y).toBeGreaterThanOrEqual(avatarBox.y + avatarBox.height);
  expect((await footer.boundingBox())!.height).toBeLessThanOrEqual(90);
  await expect(footer.getByRole('button', {name:'Sign out',exact:true})).toBeVisible();
  await page.route('**/api/discord/media?*', route => route.fulfill({status:404}));
  await page.reload();
  if (isMobile) await page.getByRole('button', {name:'Open navigation',exact:true}).click();
  await expect(footer.getByRole('img', {name:"UI Tester's avatar unavailable",exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test("staff shift switch thumbs contrast with their tracks in both states and themes", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/staff-shifts/settings`);
  const switches = [page.getByRole('switch', {name:'Staff shifts enabled',exact:true}), page.getByRole('switch', {name:'Automatically start shifts',exact:true})];
  await expect(switches[0]).toBeChecked();
  await expect(switches[1]).not.toBeChecked();
  for (const theme of ['light','dark']) {
    const toggle = page.getByRole('button', {name:`Switch to ${theme} mode`,exact:true});
    if (await toggle.count()) await toggle.click();
    for (const control of switches) {
      await expect.poll(() => control.evaluate(node => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = getComputedStyle(node.closest('[data-slot="card"]')!).backgroundColor;
        ctx.fillRect(0,0,1,1);
        ctx.fillStyle = getComputedStyle(node).backgroundColor;
        ctx.fillRect(0,0,1,1);
        const luminance = (rgb: Uint8ClampedArray) => [...rgb].slice(0,3).map(v => v/255).map(v => v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4).reduce((sum,v,i) => sum + v*[0.2126,0.7152,0.0722][i],0);
        const track = luminance(ctx.getImageData(0,0,1,1).data);
        ctx.fillStyle = getComputedStyle(node.querySelector('[data-slot="switch-thumb"]')!).backgroundColor;
        ctx.fillRect(0,0,1,1);
        const thumb = luminance(ctx.getImageData(0,0,1,1).data);
        return (Math.max(track,thumb)+0.05)/(Math.min(track,thumb)+0.05);
      })).toBeGreaterThanOrEqual(3);
    }
    for (const control of switches) await control.click();
  }
  expect(errors).toEqual([]);
});

test("previous wave selects historical dates and quota and handles missing history", async ({ page }) => {
  const errors = await mockDashboard(page);
  const previous = {...sampleShiftReport, wave:{id:'previous-wave',starts_at:'2026-10-12T00:00:00Z',ends_at:'2026-10-19T00:00:00Z',quota_hours:3}, staff:[{...sampleShiftReport.staff[0],username:'Previous Moderator',seconds:3600,wave_seconds:3600,active:false}],shifts:[],has_more:false};
  await page.route('**/api/dashboard/staff-shifts?*', route => new URL(route.request().url()).searchParams.get('period') === 'previous-wave' ? route.fulfill({json:previous}) : route.fallback());
  await page.goto(`/dashboard/${serverId}/staff-shifts`);
  const period = page.getByRole('combobox', {name:'Time period',exact:true});
  await expect(period).toHaveValue('Latest wave');
  await period.fill('Previous wave');
  const historicalRequest = page.waitForRequest(request => request.url().includes('/api/dashboard/staff-shifts?') && new URL(request.url()).searchParams.get('period') === 'previous-wave');
  await page.getByRole('option', {name:'Previous wave',exact:true}).click();
  await historicalRequest;
  await expect(period).toHaveValue('Previous wave');
  await expect(page.getByText('Previous Moderator',{exact:true}).filter({visible:true}).first()).toBeVisible();
  await expect(page.getByText(/Oct 12.*Oct 19.*3h quota/)).toBeVisible();
  const quota = page.getByRole('progressbar',{name:'Previous Moderator wave quota',exact:true});
  expect(Number(await quota.getAttribute('aria-valuenow'))).toBeCloseTo(100/3);
  await expect(page.getByText('UI Moderator',{exact:true})).toHaveCount(0);
  await period.fill('Latest wave');
  await page.getByRole('option',{name:'Latest wave',exact:true}).click();
  await expect(page.getByText('UI Moderator',{exact:true}).filter({visible:true}).first()).toBeVisible();
  await page.route('**/api/dashboard/staff-shifts?*', route => new URL(route.request().url()).searchParams.get('period') === 'previous-wave' ? route.fulfill({json:{...sampleShiftReport,wave:null,staff:[],shifts:[],has_more:false}}) : route.fallback());
  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
  await period.fill('Previous wave');
  await page.getByRole('option',{name:'Previous wave',exact:true}).click();
  await expect(page.getByText('No previous wave available yet.',{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Staff activity',exact:true})).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("setup uses shared controls with readable actions in both themes", async ({ page }) => {
  await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/settings/setup`);
  await expect(page.getByRole('heading', { name: 'Setup Complete' })).toBeVisible();
  const plugin = page.getByRole('link', { name: 'Open Plugin' });
  await expect(plugin).toHaveAttribute('data-slot', 'button');
  await expect(page.getByRole('button', { name: 'Copy security key' })).toBeVisible();
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: /Switch to .* mode/ }).first();
    if (await toggle.getAttribute('aria-label') === `Switch to ${theme} mode`) await toggle.click();
    await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', theme);
    await expect.poll(() => plugin.evaluate((element) => {
      const style = getComputedStyle(element);
      const ctx = document.createElement('canvas').getContext('2d')!;
      const luminance = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(v => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const fg = luminance(style.color), bg = luminance(style.backgroundColor);
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    })).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Reset bridge handshake' }).click();
  await expect(page.getByLabel('Place ID', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request auth key' })).toBeVisible();
});

test("server dashboard scrolls content and navigation without scrolling the document", async ({ page, isMobile }) => {
  const errors = await mockDashboard(page);
  await page.setViewportSize({width:isMobile ? 412 : 1280,height:480});
  let showNotice = false;
  await page.route('**/api/site-banners', route => route.fulfill({json:showNotice ? [{id:'layout-notice',title:'Service notice',message:'Information about your community dashboard and the latest service updates.',tone:'INFO',placement:'ALL',linkLabel:null,linkUrl:null}] : []}));
  await page.route('**/api/dashboard/staff-shifts?*', route => route.fulfill({json:{...sampleShiftReport,staff:Array.from({length:25},(_,i) => ({...sampleShiftReport.staff[0],discord_id:`staff-${i}`,username:`Moderator ${i+1}`}))}}));
  for (const notice of [true,false]) {
    showNotice = notice;
    await page.goto(`/dashboard/${serverId}/staff-shifts`);
    await expect(page.getByRole('heading',{name:'Staff shifts',exact:true})).toBeVisible({timeout:20000});
    const notices = page.getByRole('region',{name:'Site notices',exact:true});
    if (notice) await expect(notices).toBeVisible();
    else await expect(notices).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight && document.scrollingElement!.scrollWidth <= innerWidth)).toBe(true);
    const header = page.locator('.dice-shell header');
    const headerTop = (await header.boundingBox())!.y;
    const main = page.locator('.dice-shell main');
    await main.hover();
    await page.mouse.wheel(0,1000);
    await expect.poll(() => main.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect((await header.boundingBox())!.y).toBe(headerTop);
    if (isMobile) await page.getByRole('button',{name:'Open navigation',exact:true}).click();
    const nav = page.getByRole('navigation',{name:isMobile ? 'Mobile dashboard' : 'Dashboard',exact:true});
    await nav.evaluate(node => {node.scrollTop = node.scrollHeight;});
    const account = page.locator('[data-slot="sidebar-account"]').filter({visible:true});
    await expect(account.getByRole('link',{name:'Switch server',exact:true})).toBeVisible();
    const box = (await account.boundingBox())!;
    expect(box.y+box.height).toBeLessThanOrEqual(481);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    if (isMobile) await page.keyboard.press('Escape');
  }
  await page.goto('/dashboard');
  await expect(page.getByText(guild.name,{exact:true}).first()).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflowY)).not.toBe('hidden');
  expect(errors).toEqual([]);
});

test('custom modules open from the plus icon on a dedicated themed page', async ({ page, isMobile }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/modules`);
  await expect(page.getByPlaceholder('Module name')).toHaveCount(0);
  const create = page.getByRole('link', { name: 'Create custom module', exact: true });
  await expect(create).toBeVisible();
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} mode` });
    if (await toggle.count()) await toggle.click();
    await create.focus();
    await expect(page.getByRole('tooltip')).toHaveCSS('opacity', '1');
    const colors = await page.getByRole('tooltip').evaluate((node) => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, color: style.color };
    });
    expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(colors.background).not.toBe(colors.color);
  }
  if (!isMobile) {
    await create.blur();
    await create.hover();
    await expect(page.getByRole('tooltip')).toHaveCSS('opacity', '1');
  }
  await create.click();
  await expect(page).toHaveURL(`/dashboard/${serverId}/modules/new`);
  await expect(page.getByRole('heading', { name: 'Create custom module' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Module name', exact: true }).fill('Server tools');
  await page.getByRole('textbox', { name: 'Luau module source' }).fill('return {}');
  await page.route('**/api/dashboard/modules', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    expect(route.request().postDataJSON()).toMatchObject({ serverId, action: 'custom-create', name: 'Server tools', sourceCode: 'return {}' });
    await route.fulfill({ json: { ok: true } });
  });
  await page.getByRole('button', { name: 'Upload Module', exact: true }).click();
  await expect(page).toHaveURL(`/dashboard/${serverId}/modules`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("workspace header displays the server name and icon with an initials fallback", async ({ page, isMobile }) => {
  const errors = await mockDashboard(page);
  await page.route(`**/api/custom-dashboard/${serverId}`, route => route.fulfill({json: {id: serverId, name: guild.name, icon: 'server-icon'}}));
  await page.route('**/api/discord/media?*', route => route.fulfill({path: 'public/Media/Ro-LinkIcon.png'}));
  await page.goto(`/dashboard/${serverId}/staff-shifts`);
  if (isMobile) await page.getByRole('button', {name: 'Open navigation', exact: true}).click();
  const header = page.getByRole('link', {name: `${guild.name} workspace`, exact: true}).filter({visible: true});
  await expect(header).toBeVisible();
  await expect(header).toContainText(guild.name);
  const icon = header.getByRole('img', {name: `${guild.name} server icon`, exact: true});
  await expect(icon).toBeVisible();
  const iconSrc = new URL((await icon.getAttribute('src'))!, page.url());
  expect(iconSrc.pathname).toBe('/api/discord/media');
  expect(iconSrc.searchParams.get('url')).toContain(`/icons/${serverId}/server-icon.png`);
  await icon.evaluate(node => node.dispatchEvent(new Event('error')));
  await expect(header.getByRole('img', {name: `${guild.name} server icon unavailable`, exact: true})).toHaveText('UI');
  expect(errors).toEqual([]);
});

test("role command ticks contrast in light and dark modes", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/settings/roles`);
  const command = page.getByRole('button', { name: 'Kick Remove a player from the live server.', exact: true });
  await expect(command).toHaveAttribute('aria-pressed', 'false');
  await command.focus();
  await page.keyboard.press('Space');
  await expect(command).toHaveAttribute('aria-pressed', 'true');
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true });
    if (await toggle.count()) await toggle.click();
    await expect.poll(() => command.locator('svg').evaluate(icon => {
      const ctx = document.createElement('canvas').getContext('2d')!;
      const luminance = (color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const tick = luminance(getComputedStyle(icon).color);
      const box = luminance(getComputedStyle(icon.parentElement!).backgroundColor);
      if (tick === box) throw new Error(JSON.stringify({tick:getComputedStyle(icon).color,box:getComputedStyle(icon.parentElement!).backgroundColor}));
      return (Math.max(tick, box) + 0.05) / (Math.min(tick, box) + 0.05);
    })).toBeGreaterThanOrEqual(3);
  }
  await command.click();
  await expect(command).toHaveAttribute('aria-pressed', 'false');
  await expect(command.locator('svg')).toHaveCount(0);
  expect(errors).toEqual([]);
});

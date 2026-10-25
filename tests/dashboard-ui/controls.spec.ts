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
    else if (/^\/api\/dashboard\/marketplace\/[^/]+\/reviews$/.test(pathname)) body = {total:0,average:0,reviews:[],ownReview:null,hasMore:false,canReview:true,ownModule:false};
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

test("dashboard entry uses compact Dice cards and permission-aware actions", async ({ page }) => {
  const errors = await mockDashboard(page, false, { is_admin: false, can_access_dashboard: false, can_access_live_panel: true });
  const inviteGuild = { ...guild, id: 'invite-server', name: 'Invite community', hasBot: false };
  const restrictedGuild = { ...guild, id: 'role-server', name: 'Live panel staff', owner: false, permissions: '0', isRoleAccess: true };
  await page.route('**/api/guilds', route => route.fulfill({ json: [inviteGuild, restrictedGuild, guild] }));
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(mode => localStorage.setItem('rolink-theme', mode), theme);
    await page.goto('/dashboard');
    const cards = page.getByRole('main').locator('[data-slot="card"]');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toHaveAttribute('aria-label', restrictedGuild.name);
    const restricted = page.getByRole('region', { name: restrictedGuild.name, exact: true });
    await expect(restricted.getByRole('link', { name: 'Live Panel', exact: true })).toHaveAttribute('data-slot', 'button');
    await expect(restricted.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
    const owner = page.getByRole('region', { name: guild.name, exact: true });
    await expect(owner.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('href', `/dashboard/${serverId}`);
    await expect(owner.getByText('Installed', { exact: true })).toHaveAttribute('data-slot', 'status-label');
    await expect(owner.locator('[data-slot="card-header"]')).toBeVisible();
    await expect(owner.locator('[data-slot="card-footer"]')).toBeVisible();
    await expect(owner.getByRole('link', { name: /marketplace|staff shifts/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /sign out/i })).toHaveAttribute('data-slot', 'button');
    await expect(page.getByRole('link', { name: 'Open Marketplace' })).toHaveAttribute('data-slot', 'button');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', theme);
    await page.screenshot({ path: `/workspace/artifacts/dice-${theme}-server-list-${test.info().project.name}.png` });
  }
  expect(errors).toEqual([]);
});

test("dashboard entry keeps themed empty, error, and expired-session states", async ({ page }) => {
  const errors = await mockDashboard(page);
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(mode => localStorage.setItem('rolink-theme', mode), theme);
    for (const state of ['empty', 'error', 'expired']) {
      await page.route('**/api/guilds', route => route.fulfill({ status: state === 'empty' ? 200 : state === 'expired' ? 401 : 500, json: state === 'empty' ? [] : { error: 'Unable to fetch Discord servers.' } }));
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: state === 'empty' ? 'No servers available' : state === 'expired' ? 'Discord session expired' : 'Could not load servers', exact: true })).toBeVisible();
      if (state !== 'empty') await expect(page.getByRole('button', { name: state === 'expired' ? 'Sign in again' : 'Retry', exact: true })).toHaveAttribute('data-slot', 'button');
      const description = page.getByRole('main').locator('[data-slot="card-description"]');
      const colors = await description.evaluate(el => ({ text: getComputedStyle(el).color, background: getComputedStyle(el.closest('[data-slot="card"]')!).backgroundColor }));
      expect(colors.text).not.toEqual(colors.background);
    }
  }
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
  await page.getByRole('button', { name: 'Install module', exact: true }).click();
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
  const header = page.locator('[data-dashboard-header]');
  const counts = header.getByLabel('Live panel counts');
  await expect(counts.getByText('Servers', {exact:true})).toBeVisible();
  await expect(counts.getByText('Pending reports', {exact:true})).toBeAttached();
  await expect(counts.locator('[data-slot="stat-value"]').first()).toHaveCSS('font-size', '12px');
  const summaryBox = (await personal.boundingBox())!;
  expect(summaryBox.width).toBeGreaterThan(page.viewportSize()!.width - 70);
  if (test.info().project.name === 'desktop') expect(summaryBox.height).toBeLessThan(65);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await expect(personal.getByRole('progressbar', {name:'Progress toward wave quota',exact:true})).toHaveAttribute('aria-valuenow', '40');
  const stopped = page.waitForRequest(request => request.url().includes('/api/dashboard/staff-shifts') && request.method() === 'POST');
  await personal.getByRole('button', {name:'End shift',exact:true}).click();
  expect((await stopped).postDataJSON()).toEqual({serverId, action:'stop'});
  await expect(personal.getByText('4.00 total hours · 6 shifts', {exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

for (const scenario of [
  { name: 'staff shifts are disabled', enabled: false, quota: 5 },
  { name: 'the wave has no quota', enabled: true, quota: 0 },
]) {
  test(`Live Panel hides disabled shift UI when ${scenario.name}`, async ({ page }) => {
    const errors = await mockDashboard(page);
    await page.route('**/api/dashboard/staff-shifts?*', route => route.fulfill({json: {
      ...sampleShiftReport,
      settings: {...sampleShiftReport.settings, enabled: scenario.enabled},
      wave: {...sampleShiftReport.wave, quota_hours: scenario.quota},
    }}));
    await page.goto(`/dashboard/${serverId}/live-panel`);
    const personal = page.getByRole('region', {name:'Your staff shifts',exact:true});
    if (scenario.enabled) {
      await expect(personal.getByText('4.00 total hours · 6 shifts', {exact:true})).toBeVisible();
      await expect(personal.getByText('Wave quota', {exact:true})).toHaveCount(0);
      await expect(personal.getByRole('progressbar')).toHaveCount(0);
      await expect(personal.getByRole('button', {name:'End shift',exact:true})).toBeVisible();
    } else {
      await expect(page.getByLabel('Live panel counts')).toBeVisible();
      await expect(personal).toHaveCount(0);
      await expect(page.locator('[data-slot="staff-shift-summary"]')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

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

test("dashboard panels use Dice headers without repeating page icons", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await mockDashboard(page);
  for (const [route, title] of [
    ['settings/commands', 'Global Command Modules'],
    ['settings/logging', 'Audit Logging'],
    ['settings/reports', 'Report System'],
    ['settings/dashboard', 'Custom Dashboard'],
    ['verification', 'Toggle Verification'],
  ]) {
    await page.goto(`/dashboard/${serverId}/${route}`);
    await expect(page.locator('[data-slot="page-icon"]')).toHaveCount(1);
    const titleElement = page.getByRole('heading', { name: title, level: 2, exact: true });
    await expect(titleElement).toHaveAttribute('data-slot', 'card-title');
    const header = page.locator('[data-slot="card-header"]').filter({ has: titleElement });
    await expect(header).toHaveAttribute('data-slot', 'card-header');
    await expect(header.locator('svg')).toHaveCount(0);
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true });
      if (await toggle.count()) await toggle.click();
      await expect(page.locator('.dice-ui-dashboard').first()).toHaveCSS('color-scheme', theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `/workspace/artifacts/panels-${route.replaceAll('/', '-')}-${theme}-${test.info().project.name}.png` });
    }
  }
  await page.goto(`/dashboard/${serverId}/settings/commands`);
  const admin = page.getByRole('switch', { name: 'Admin commands', exact: true });
  const before = await admin.isChecked();
  await admin.focus();
  await page.keyboard.press('Space');
  const save = page.waitForRequest(request => request.url().includes('/api/dashboard/server-config') && request.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save Settings', exact: true }).click();
  expect((await save).postDataJSON().updates).toMatchObject({ admin_cmds_enabled: !before });
  await page.goto(`/dashboard/${serverId}/settings`);
  await page.getByRole('button', { name: 'Remove Ro-Link', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Remove Ro-Link', exact: true });
  await expect(dialog).toBeVisible();
  const deleteData = dialog.getByRole('checkbox', { name: /Delete Ro-Link Data/ });
  await deleteData.focus();
  await page.keyboard.press('Space');
  await expect(deleteData).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('save confirmations expire after three seconds and errors remain visible', async ({ page }) => {
  await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/staff-shifts/settings`);
  const save = page.getByRole('button', { name: 'Save shift settings', exact: true });
  await expect(save).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await save.click();
  const confirmation = page.getByRole('status');
  await expect(confirmation).toHaveText('Shift settings saved.');
  await page.clock.runFor(2999);
  await expect(confirmation).toBeVisible();
  // Repeating the same message starts a fresh timer.
  await save.click();
  await page.clock.runFor(1);
  await expect(confirmation).toBeVisible();
  await page.clock.runFor(2999);
  await expect(confirmation).toBeHidden();
  await page.route('**/api/dashboard/staff-shifts/settings', route =>
    route.fulfill({ status: 500, json: { error: 'Could not save shift settings.' } }));
  await save.click();
  await expect(page.getByText('Could not save shift settings.', { exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByText('Could not save shift settings.', { exact: true })).toBeVisible();
});

test("live command suggestions have room for descriptions without CMD badges", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.goto(`/dashboard/${serverId}/live-panel`);
  await page.getByRole('button', { name: 'Run Command', exact: true }).click();
  const input = page.getByPlaceholder('refresh username');
  const suggestion = page.getByRole('button', { name: /^Kick Remove a player/ });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => {
      localStorage.setItem('rolink-theme', value);
      document.documentElement.classList.toggle('dark', value === 'dark');
    }, theme);
    await expect(suggestion).toBeVisible();
    await expect(page.getByText('CMD', { exact: true })).toHaveCount(0);
    const spacing = await suggestion.evaluate(row => {
      const style = getComputedStyle(row);
      const description = row.querySelector('span.min-w-0 > span:last-child')!;
      const rowBox = row.getBoundingClientRect();
      const textBox = description.getBoundingClientRect();
      return { top: parseFloat(style.paddingTop), bottom: rowBox.bottom - textBox.bottom, height: rowBox.height };
    });
    expect(spacing.top).toBeGreaterThanOrEqual(12);
    expect(spacing.bottom).toBeGreaterThanOrEqual(12);
    expect(spacing.height).toBeGreaterThanOrEqual(56);
    await suggestion.focus();
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue(/kick/i);
    await input.fill('');
  }
  expect(errors).toEqual([]);
});


test("Live Panel Dice dialogs, menus, and controls preserve command flows", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await mockDashboard(page);
  const liveServer = { ...sampleServer, players: [{ username: 'DicePlayer', displayName: 'Dice Player', userId: '42', avatarUrl: null }] };
  await page.route('**/api/dashboard/live-panel?*', route => route.fulfill({json: { server: { placeId: '1234' }, liveServers: [liveServer], playerActivity: [], modulePanelCommands: [], pendingReports: [], logs: [{id:'log-dice',action:'KICK',moderator:'Moderator',target:'DicePlayer',timestamp:'2026-10-24T00:00:00Z'}] }}));
  await page.route('**/api/dashboard/live-servers?*', route => route.fulfill({json: [liveServer]}));
  await page.route('**/api/dashboard/runtime-logs?*', route => route.fulfill({json: {logs:[{id:'runtime-dice',created_at:'2026-10-24T00:00:00Z',level:'info',message:'Runtime fixture line'}]}}));
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(value => localStorage.setItem('rolink-theme', value), theme);
    await page.goto(`/dashboard/${serverId}/live-panel`);
    await expect(page.getByRole('region', {name:'Live operations',exact:true})).toBeVisible();
    await expect(page.getByRole('table', {name:'Live moderation activity'})).toBeVisible();
    await expect(page.getByLabel('Search live servers')).toHaveAttribute('data-slot','input');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-live-panel-${test.info().project.name}.png`});

    await page.getByRole('button', {name:'Run Command',exact:true}).click();
    const commandDialog = page.getByRole('dialog', {name:'Run Live Command',exact:true});
    await expect(commandDialog).toHaveAttribute('data-slot','dialog-content');
    await expect(commandDialog).toHaveCSS('color-scheme',theme);
    await commandDialog.getByLabel('Live command').fill('refresh DicePlayer');
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-live-command-${test.info().project.name}.png`});
    let sent = page.waitForRequest(r => r.url().includes('/api/dashboard/command') && r.method()==='POST');
    await commandDialog.getByRole('button', {name:'Run Command',exact:true}).click();
    expect((await sent).postDataJSON()).toMatchObject({serverId,command:'REFRESH',args:{username:'DicePlayer'}});
    await expect(commandDialog).toBeHidden();

    await page.getByRole('button', {name:'Announce',exact:true}).click();
    const announce = page.getByRole('dialog', {name:'Announce to Live Servers',exact:true});
    const target = announce.getByRole('combobox', {name:'Announcement target',exact:true});
    await target.fill('All live');
    await page.getByRole('option', {name:'All live servers',exact:true}).click();
    await announce.getByLabel('Announcement message').fill('Dice UI fixture announcement');
    sent = page.waitForRequest(r => r.url().includes('/api/dashboard/command') && r.method()==='POST');
    await announce.getByRole('button', {name:'Send Announcement',exact:true}).click();
    expect((await sent).postDataJSON()).toMatchObject({command:'BROADCAST',args:{message:'Dice UI fixture announcement',target_scope:'GLOBAL'}});
    await expect(announce).toBeHidden();

    await page.getByRole('button', {name:/^Restart server /}).click();
    const confirmation = page.getByRole('dialog', {name:'Restart server',exact:true});
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', {name:'Cancel',exact:true}).click();
    await expect(confirmation).toBeHidden();
    await page.getByRole('button', {name:/^Restart server /}).click();
    sent = page.waitForRequest(r => r.url().includes('/api/dashboard/command') && r.method()==='POST');
    await confirmation.getByRole('button', {name:'Confirm',exact:true}).click();
    expect((await sent).postDataJSON()).toMatchObject({command:'UPDATE',args:{job_id:liveServer.id,target_scope:'SERVER'}});

    await page.getByRole('button', {name:/^Server actions /}).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCSS('color-scheme',theme);
    await page.getByRole('menuitem', {name:'View server logs',exact:true}).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Runtime fixture line/)).toBeVisible();
    await page.getByRole('button', {name:'Return to live commands',exact:true}).click();

    await page.getByRole('button', {name:'Open profile for DicePlayer',exact:true}).click();
    await expect(page.getByRole('heading', {name:'Live Panel Profile',exact:true})).toBeVisible();
    await page.getByRole('button', {name:'Kick',exact:true}).click();
    const kick = page.getByRole('dialog', {name:'Kick DicePlayer',exact:true});
    await expect(kick).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(kick).toBeHidden();
    await page.getByLabel('Staff note', {exact:true}).fill('Dice UI fixture note');
    const note = page.waitForRequest(r => r.url().includes('/api/dashboard/staff-notes') && r.method()==='POST');
    await page.getByRole('button', {name:'Save Note',exact:true}).click();
    expect((await note).postDataJSON()).toMatchObject({robloxUsername:'DicePlayer',note:'Dice UI fixture note'});
    await page.getByRole('button', {name:'Close player profile',exact:true}).click();
  }
  expect(errors).toEqual([]);
});

test("Live Panel reports use themed confirmation and respect limited-role actions", async ({ page }) => {
  const errors = await mockDashboard(page);
  let report = { id:'report-dice', server_id:serverId, reported_roblox_username:'DicePlayer', reporter_roblox_username:'Reporter', reason:'Fixture report evidence', status:'PENDING', created_at:'2026-10-24T00:00:00Z', moderator_note:'' };
  await page.route('**/api/dashboard/live-panel?*', route => route.fulfill({json:{server:{placeId:'1234'},liveServers:[sampleServer],logs:[],pendingReports:[report]}}));
  await page.route('**/api/reports**', async route => {
    if (route.request().method() === 'PATCH') {
      report = {...report,...route.request().postDataJSON()};
      await route.fulfill({json:report});
    } else if (new URL(route.request().url()).pathname.endsWith('/context')) {
      await route.fulfill({json:{report,profile:{roblox_username:'DicePlayer'},logs:[]}});
    } else await route.fulfill({json:[report]});
  });
  for (const theme of ['light','dark']) {
    report = {...report,status:'PENDING'};
    await page.addInitScript(value => localStorage.setItem('rolink-theme',value),theme);
    await page.goto(`/dashboard/${serverId}/live-panel`);
    await page.getByRole('button',{name:'Unmoderated reports: 1',exact:true}).click();
    const search = page.getByRole('textbox',{name:'Search reports',exact:true});
    await search.fill('DicePlayer');
    await expect(page.getByRole('heading',{name:'Report Evidence',exact:true})).toHaveCount(0);
    const openReport = page.getByRole('button',{name:/^Open report .* for DicePlayer$/});
    await openReport.click();
    const details = page.getByRole('region',{name:'Report details',exact:true});
    await expect(page.getByRole('heading',{name:'Report Evidence',exact:true})).toBeVisible();
    await expect(page.locator('[data-slot="report-list"]')).toHaveCount(0);
    const pane = (await page.getByRole('region',{name:'Player activity',exact:true}).boundingBox())!;
    const detailBox = (await details.boundingBox())!;
    expect(Math.abs(detailBox.width - (pane.width - 2))).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-live-report-details-${test.info().project.name}.png`});
    await page.getByRole('button',{name:'Back to reports',exact:true}).click();
    await expect(details).toHaveCount(0);
    await expect(search).toHaveValue('DicePlayer');
    await openReport.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading',{name:'Report Evidence',exact:true})).toBeVisible();
    await page.getByLabel('Moderator note',{exact:true}).fill('Reviewed with Dice UI');
    await page.getByRole('button',{name:'Resolve',exact:true}).click();
    const confirm = page.getByRole('dialog',{name:/Resolve report/});
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByLabel('Moderator note',{exact:true})).toHaveValue('Reviewed with Dice UI');
    await page.getByRole('button',{name:'Resolve',exact:true}).click();
    const update = page.waitForRequest(r => r.url().includes('/api/reports/report-dice?') && r.method()==='PATCH');
    await confirm.getByRole('button',{name:'Confirm',exact:true}).click();
    expect((await update).postDataJSON()).toEqual({status:'RESOLVED',moderatorNote:'Reviewed with Dice UI'});
    await expect(confirm).toBeHidden();
    await expect(page.locator('[data-slot="report-list"]')).toBeVisible();
    await expect(details).toHaveCount(0);
  }
  await page.route('**/api/reports/report-dice/context?*', route => route.fulfill({status:500,json:{error:'Report detail unavailable.'}}));
  await page.getByRole('button',{name:/^Open report .* for DicePlayer$/}).click();
  await expect(page.getByRole('alert').filter({hasText:'Report detail unavailable.'})).toBeVisible();
  await page.getByRole('button',{name:'Back to reports',exact:true}).click();
  await expect(page.locator('[data-slot="report-list"]')).toBeVisible();
  await page.route('**/api/user/permissions?*',route=>route.fulfill({json:{is_admin:false,can_access_dashboard:true,can_access_live_panel:true,can_manage_reports:false,can_view_runtime_logs:false,allowed_misc_cmds:[]}}));
  await page.goto(`/dashboard/${serverId}/live-panel`);
  await expect(page.getByRole('heading',{name:'Quick actions',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Run Command',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Announce',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Unmoderated reports/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^Server actions |^Restart server |^Shut down server /})).toHaveCount(0);
  expect(errors).toEqual([]);
});


test("Live Panel searches Roblox as users type and limits both lists to five matches", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.route('**/api/dashboard/live-panel?**', route => route.fulfill({ json: {
    server: { placeId: '1234' }, liveServers: [sampleServer], playerActivity: [], modulePanelCommands: [], pendingReports: [],
    logs: [
      { id: 'recent', action: 'STAFF_NOTE', target: 'cher1234', moderator: 'Staff', timestamp: new Date(Date.now() - 30 * 60_000).toISOString() },
      { id: 'old', action: 'STAFF_NOTE', target: 'cher', moderator: 'Staff', timestamp: new Date(Date.now() - 61 * 60_000).toISOString() },
    ],
  } }));
  const queries: string[] = [];
  await page.route('**/api/dashboard/modules/input-options?**', async route => {
    const query = new URL(route.request().url()).searchParams.get('query')!;
    queries.push(query);
    const names = [query + 'LongName', query + '12', query + '1', query, query + '123', query + '1234'];
    await route.fulfill({ json: { options: names.map((username, index) => ({
      data: { username, displayName: username, userId: String(7000 + index) },
    })) } });
  });
  await page.goto(`/dashboard/${serverId}/live-panel`);
  const profile = page.getByRole('textbox', { name: 'Search player profiles' });
  await profile.fill('cher');
  const list = profile.locator('..').locator('> div');
  await expect(list.getByRole('button')).toHaveCount(5);
  await expect(list.getByRole('button').first().getByText('@cher1234', { exact: true })).toBeVisible();
  await expect(list.getByRole('button').nth(1).getByText('@cher', { exact: true })).toBeVisible();
  await expect(list).toHaveCSS('overflow-y', 'auto');
  await profile.fill('jamie');
  await expect(list.getByRole('button')).toHaveCount(5);
  await expect(list.getByRole('button').first()).toContainText('@jamie');
  await expect(list).not.toContainText('@cher');
  await profile.fill('');
  await page.getByRole('button', { name: 'Run Command', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const command = dialog.getByRole('textbox', { name: 'Live command' });
  await command.fill('Soft Ban cher');
  const matches = dialog.getByRole('button').filter({ hasText: /@(?:cher|jamie)/ });
  await expect(matches).toHaveCount(5);
  await expect(matches.first()).toContainText('@cher1234');
  await command.fill('Soft Ban jamie');
  await expect(matches).toHaveCount(5);
  await expect(matches.first()).toContainText('@jamie');
  await expect(dialog).not.toContainText('@cher');
  await matches.first().focus();
  await page.keyboard.press('Enter');
  await expect(command).toHaveValue('Soft Ban jamie');
  expect(queries).toContain('cher');
  expect(queries).toContain('jamie');
  expect(queries).not.toContain('soft');
  expect(errors).toEqual([]);
});

test("Live Panel uses in-game identities without calling Roblox search", async ({ page }) => {
  const errors = await mockDashboard(page);
  const inGameServer = { ...sampleServer, updated_at: new Date().toISOString(), players: [
    { username: 'InGameJamie', displayName: 'Jamie Display', userId: '9876543' },
  ] };
  await page.route('**/api/dashboard/live-servers?**', route => route.fulfill({ json: [inGameServer] }));
  await page.route('**/api/dashboard/live-panel?**', route => route.fulfill({ json: {
    server: { placeId: '1234' },
    liveServers: [inGameServer],
    playerActivity: [], modulePanelCommands: [], logs: [], pendingReports: [],
  } }));
  const queries: string[] = [];
  await page.route('**/api/dashboard/modules/input-options?**', route => {
    queries.push(new URL(route.request().url()).searchParams.get('query')!);
    return route.fulfill({ json: { options: [] } });
  });
  await page.goto(`/dashboard/${serverId}/live-panel`);
  const profile = page.getByRole('textbox', { name: 'Search player profiles' });
  await expect(page.getByRole('button', { name: 'Run Command', exact: true })).toBeVisible();
  await profile.fill('ingame');
  await expect(profile.locator('..').getByRole('button')).toContainText('@InGameJamie');
  await page.waitForTimeout(500);
  expect(queries).toEqual([]);
  await profile.fill('');
  await page.getByRole('button', { name: 'Run Command', exact: true }).click();
  const command = page.getByRole('dialog').getByRole('textbox', { name: 'Live command' });
  for (const query of ['ingame', 'InGameJamie', '9876543', 'Jamie Display']) {
    await command.fill(`Soft Ban ${query}`);
    await expect(page.getByRole('dialog').getByRole('button').filter({ hasText: '@InGameJamie' })).toBeVisible();
    await page.waitForTimeout(500);
    expect(queries).toEqual([]);
  }
  await command.fill('Soft Ban unknownuser');
  await expect.poll(() => queries).toEqual(['unknownuser']);
  expect(errors).toEqual([]);
});

test("Live Panel searches connected accounts before Roblox and labels the link", async ({ page }) => {
  const errors = await mockDashboard(page);
  await page.route('**/api/dashboard/live-panel?**', route => route.fulfill({ json: {
    server: { placeId: '1234' }, liveServers: [sampleServer], playerActivity: [], modulePanelCommands: [], pendingReports: [],
    logs: [{ id: 'connected-log', action: 'STAFF_NOTE', target: '<@111222333>', moderator: 'Staff', timestamp: new Date(Date.now() - 60_000).toISOString() }],
  } }));
  await page.route('**/api/dashboard/linked-users?**', route => route.fulfill({ json: { users: [{
    username: 'ConnectedJamie', displayName: 'ConnectedJamie', userId: '888777', connectedDiscordId: '111222333', avatarUrl: null,
  }, { username: 'Connected', displayName: 'Connected', userId: '888999', connectedDiscordId: '444555666', avatarUrl: null }] } }));
  const remoteQueries: string[] = [];
  await page.route('**/api/dashboard/modules/input-options?**', route => {
    remoteQueries.push(route.request().url());
    return route.fulfill({ json: { options: [] } });
  });
  await page.goto(`/dashboard/${serverId}/live-panel`);
  const profile = page.getByRole('textbox', { name: 'Search player profiles' });
  await profile.fill('connected');
  const result = profile.locator('..').getByRole('button').first();
  await expect(result).toContainText('@ConnectedJamie');
  await expect(result).toContainText('Connected to Discord');
  await profile.fill('');
  await page.getByRole('button', { name: 'Run Command', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const command = dialog.getByRole('textbox', { name: 'Live command' });
  await command.fill('Soft Ban 111222333');
  const suggestion = dialog.getByRole('button').filter({ hasText: '@ConnectedJamie' });
  await expect(suggestion).toContainText('Connected to Discord');
  await suggestion.focus();
  await page.keyboard.press('Enter');
  await expect(command).toHaveValue('Soft Ban ConnectedJamie');
  expect(remoteQueries).toEqual([]);
  expect(errors).toEqual([]);
});

test("marketplace Dice filters, product fields, and multi-server installs work in both themes", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await mockDashboard(page);
  const targets = [
    {...guild,installedModuleCount:0,moduleLimit:5},
    {...guild,id:'second-server',name:'Second community',installedModuleCount:1,moduleLimit:5},
    {...guild,id:'full-server',name:'Full community',installedModuleCount:5,moduleLimit:5},
  ];
  const audit = {...sampleModule,id:'audit-module',slug:'audit-tools',name:'Audit tools',category:'Moderation',isOfficial:false,creatorIsVerified:false};
  await page.route('**/api/dashboard/marketplace', route => route.fulfill({json:{modules:[sampleModule,audit],installTargets:targets}}));
  let failInstall = false;
  await page.route('**/api/dashboard/modules', route => route.fulfill({status:failInstall ? 500 : 200,json:failInstall ? {error:'Installation fixture failed.'} : {ok:true}}));
  for (const theme of ['light','dark']) {
    failInstall = false;
    await page.addInitScript(value => localStorage.setItem('rolink-theme',value),theme);
    await page.goto('/dashboard/marketplace');
    const welcome = page.getByRole('region',{name:sampleModule.name,exact:true});
    await expect(welcome.locator('[data-slot="card-footer"]')).toBeVisible();
    await expect(welcome.getByText('Official',{exact:true})).toBeVisible();
    const category = page.getByRole('combobox',{name:'Module category',exact:true});
    await category.fill('Moderation');
    await page.getByRole('option',{name:'Moderation',exact:true}).click();
    await expect(welcome).toHaveCount(0);
    await expect(page.getByRole('link',{name:'View Audit tools',exact:true})).toBeVisible();
    const search = page.getByRole('textbox',{name:'Search modules',exact:true});
    await search.fill('nothing matches');
    await expect(page.getByRole('heading',{name:'No modules found',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Reset filters',exact:true}).click();
    await expect(welcome).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-marketplace-${test.info().project.name}.png`});
    await page.getByRole('link',{name:`View ${sampleModule.name}`,exact:true}).click();
    await expect(page.getByRole('table',{name:'Module configuration fields',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Module details',exact:true})).toBeVisible();
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-marketplace-product-${test.info().project.name}.png`});
    await page.getByRole('button',{name:'Install module',exact:true}).click();
    const dialog = page.getByRole('dialog',{name:sampleModule.name,exact:true});
    await expect(dialog).toHaveCSS('color-scheme',theme);
    const multi = dialog.getByRole('switch',{name:'Multi-server selection',exact:true});
    await multi.click();
    await expect(dialog.getByRole('checkbox',{name:'Select Full community',exact:true})).toBeDisabled();
    await expect(dialog.getByRole('button',{name:'Install Selected',exact:true})).toBeDisabled();
    const first = dialog.getByRole('checkbox',{name:`Select ${guild.name}`,exact:true});
    await first.focus();
    await page.keyboard.press('Space');
    await expect(first).toBeChecked();
    await dialog.getByRole('checkbox',{name:'Select Second community',exact:true}).click();
    await expect(dialog.getByText('2 servers selected',{exact:true})).toBeVisible();
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height - 30);
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-marketplace-install-${test.info().project.name}.png`});
    const firstRequest = page.waitForRequest(r=>r.url().includes('/api/dashboard/modules')&&r.method()==='POST'&&r.postDataJSON().serverId===serverId);
    const secondRequest = page.waitForRequest(r=>r.url().includes('/api/dashboard/modules')&&r.method()==='POST'&&r.postDataJSON().serverId==='second-server');
    await dialog.getByRole('button',{name:'Install Selected',exact:true}).click();
    for (const request of await Promise.all([firstRequest,secondRequest])) expect(request.postDataJSON()).toMatchObject({moduleId:sampleModule.id,action:'install'});
    await expect(dialog.getByText('Installed to 2 servers.',{exact:true})).toBeVisible();
    await expect(multi).not.toBeChecked();
    failInstall = true;
    await dialog.getByRole('button',{name:new RegExp(guild.name)}).click();
    await expect(dialog.getByRole('alert')).toContainText('Installation fixture failed.');
    await expect(dialog.getByRole('button',{name:'Close install picker',exact:true})).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test("marketplace empty, unavailable, and missing-product states use shared cards", async ({ page }) => {
  const errors = await mockDashboard(page);
  for (const theme of ['light','dark']) {
    await page.addInitScript(value => localStorage.setItem('rolink-theme',value),theme);
    await page.route('**/api/dashboard/marketplace',route=>route.fulfill({json:{modules:[],installTargets:[]}}));
    await page.goto('/dashboard/marketplace');
    await expect(page.getByRole('heading',{name:'No modules found',exact:true})).toHaveAttribute('data-slot','card-title');
    await page.goto('/dashboard/marketplace/missing-module');
    await expect(page.getByRole('heading',{name:'Module not found',exact:true})).toHaveAttribute('data-slot','card-title');
    await page.route('**/api/dashboard/marketplace',route=>route.fulfill({status:500,json:{error:'Marketplace fixture unavailable.'}}));
    await page.goto('/dashboard/marketplace');
    await expect(page.getByRole('main').getByRole('alert')).toHaveAttribute('data-slot','card');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Marketplace fixture unavailable.');
    await page.route('**/api/dashboard/marketplace',route=>route.fulfill({json:{modules:[sampleModule],installTargets:[]}}));
    await page.goto(`/dashboard/marketplace/${sampleModule.slug}`);
    await page.getByRole('button',{name:'Install module',exact:true}).click();
    const emptyPicker = page.getByRole('dialog',{name:sampleModule.name,exact:true});
    await expect(emptyPicker.getByText('No servers are available for module installs.',{exact:true})).toBeVisible();
    await expect(emptyPicker.getByRole('switch')).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});


test("marketplace preview cards fit four to five across on laptops and expand on wider screens", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await mockDashboard(page);
  const authorId = '234567890123456789';
  const modules = Array.from({length:12},(_,index)=>({...sampleModule,id:`preview-${index}`,slug:`preview-${index}`,name:`Community module ${index + 1}`,reviewRating:index===0?{average:4.3,total:12}:index===1?{average:0,total:0}:null,authorDiscordId:index===0?'test-user':authorId,isOfficial:index===0,creatorIsVerified:index===1}));
  const authorRequests: string[] = [];
  await page.route('**/api/dashboard/marketplace',route=>route.fulfill({json:{modules,installTargets:[]}}));
  await page.route('**/api/discord/user?*',route=>{
    authorRequests.push(new URL(route.request().url()).searchParams.get('userId')!);
    return route.fulfill({json:{id:authorId,username:'CommunityBuilder',avatar_url:'/Media/Ro-LinkIcon.png'}});
  });
  for (const theme of ['light','dark']) {
    await page.addInitScript(value=>localStorage.setItem('rolink-theme',value),theme);
    await page.goto('/dashboard/marketplace');
    const grid = page.locator('[data-slot="marketplace-grid"]');
    const cards = grid.locator('[data-slot="card"]');
    await expect(cards).toHaveCount(12);
    await expect(cards.first().getByRole('img',{name:'4.3 out of 5 stars'})).toBeVisible();
    await expect(cards.first().getByText('4.3 (12)',{exact:true})).toBeVisible();
    await expect(cards.nth(1).getByText('No reviews yet',{exact:true})).toBeVisible();
    await expect(cards.nth(2).getByText('Rating unavailable',{exact:true})).toBeVisible();
    await expect(cards.first().getByRole('radio')).toHaveCount(0);

    await expect(cards.first().getByText('Yours',{exact:true})).toBeVisible();
    await expect(cards.nth(1).getByText('Yours',{exact:true})).toHaveCount(0);
    await expect(cards.nth(1).getByText('CommunityBuilder',{exact:true})).toBeVisible();
    await expect(cards.first().getByText('UI Tester',{exact:true})).toBeVisible();
    await expect(cards.first().getByText('Official',{exact:true})).toHaveAttribute('data-slot','status-label');
    for (const [width, expectedColumns] of [[640,2],[768,3],[1024,4],[1280,5],[1366,5],[1440,5],[1536,6],[1920,7],[2560,10]]) {
      await page.setViewportSize({width,height:900});
      const columns = await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(expectedColumns);
      const row = await Promise.all(Array.from({length:expectedColumns},(_,index)=>cards.nth(index).boundingBox()));
      if(width>=1024) {
        expect(row[0]!.width).toBeLessThan(270);
        expect(row[0]!.height).toBeLessThan(380);
      }
      expect(Math.max(...row.map(box=>box!.y))-Math.min(...row.map(box=>box!.y))).toBeLessThan(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await page.setViewportSize({width:1280,height:900});
    const preview = await cards.first().locator('[data-slot="module-preview"]').boundingBox();
    expect(Math.abs(preview!.width/preview!.height-16/9)).toBeLessThan(0.02);
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-marketplace-preview-cards-${test.info().project.name}.png`});
    await page.setViewportSize({width:390,height:844});
    await expect.poll(()=>grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(authorRequests).toEqual([authorId,authorId]);
  await page.route('**/api/discord/user?*',route=>route.fulfill({status:503,json:{error:'Creator profile unavailable'}}));
  await page.goto('/dashboard/marketplace');
  await expect(page.locator('[data-slot="marketplace-grid"] [data-slot="card"]').nth(2).getByText('Community creator',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('marketplace synchronizes installs and removals without reloading', async ({ page }) => {
  const errors = await mockDashboard(page);
  let installedIds: string[] = [];
  let fail = false;
  await page.route('**/api/dashboard/marketplace', route => route.fulfill({ json: {
    modules: [sampleModule], installTargets: [{ ...guild, installedModuleIds: installedIds, installedModuleCount: installedIds.length, moduleLimit: 1 }],
  } }));
  await page.route('**/api/dashboard/modules', async route => {
    const { action, moduleId } = route.request().postDataJSON();
    if (fail) return route.fulfill({ status: 500, json: { error: 'Please retry.' } });
    installedIds = action === 'remove' ? [] : [moduleId];
    await route.fulfill({ json: { success: true } });
  });
  for (const theme of ['light', 'dark']) {
    installedIds = [];
    await page.addInitScript(value => localStorage.setItem('rolink-theme', value), theme);
    await page.goto(`/dashboard/marketplace/${sampleModule.slug}`);
    await page.getByRole('button', { name: 'Install module', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: sampleModule.name, exact: true });
    const install = dialog.getByRole('button', { name: `Install module on ${guild.name}`, exact: true });
    const remove = dialog.getByRole('button', { name: `Remove module on ${guild.name}`, exact: true });
    await install.click();
    await expect(remove).toBeEnabled();
    await expect(dialog.getByText('1/1 installed · Limit reached', { exact: true })).toBeVisible();
    fail = true;
    await remove.click();
    await expect(dialog.getByRole('alert')).toContainText('Please retry.');
    await expect(remove).toBeEnabled();
    fail = false;
    await remove.click();
    await expect(install).toBeEnabled();
    await expect(dialog.getByText('0/1 installed', { exact: true })).toBeVisible();
    // Simulate another administrator installing and then removing the module.
    installedIds = [sampleModule.id];
    await expect(remove).toBeEnabled({ timeout: 10_000 });
    installedIds = [];
    await expect(install).toBeEnabled({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});
test("module product reviews publish, edit, persist, paginate, and delete with Dice ratings", async ({ page }) => {
  test.setTimeout(120_000);
  const errors=await mockDashboard(page);
  let own: {id:string;rating:number;comment:string}|null=null;
  let peers=0;
  await page.route(`**/api/dashboard/marketplace/${sampleModule.id}/reviews**`,async route=>{
    if(route.request().method()==='POST') { own={id:'own-review',...route.request().postDataJSON()};await route.fulfill({json:{ok:true}});return; }
    if(route.request().method()==='DELETE') {own=null;await route.fulfill({json:{ok:true}});return;}
    const offset=Number(new URL(route.request().url()).searchParams.get('offset')||0);
    const reviews=[...(own?[{...own,name:'UI Tester',avatarUrl:null,createdAt:'2026-10-25T00:00:00Z',updatedAt:'2026-10-25T00:00:00Z',isOwn:true}]:[]),...Array.from({length:peers},(_,index)=>({id:`peer-${index}`,rating:4,comment:`Installer feedback ${index}`,name:`Installer ${index}`,avatarUrl:null,createdAt:'2026-10-24T00:00:00Z',updatedAt:'2026-10-24T00:00:00Z',isOwn:false}))];
    await route.fulfill({json:{total:reviews.length,average:reviews.length?Number((reviews.reduce((sum,row)=>sum+row.rating,0)/reviews.length).toFixed(1)):0,reviews:reviews.slice(offset,offset+10),ownReview:own,canReview:true,ownModule:true,hasMore:reviews.length>offset+10}});
  });
  for(const theme of ['light','dark']) {
    own=null;peers=0;
    await page.addInitScript(value=>localStorage.setItem('rolink-theme',value),theme);
    await page.goto(`/dashboard/marketplace/${sampleModule.slug}`);
    const reviews=page.locator('#module-reviews');
    await expect(reviews.getByText('You are reviewing your own module.',{exact:true})).toBeVisible();
    const rating=reviews.getByRole('radiogroup',{name:'Your rating',exact:true});
    const comment=reviews.getByRole('textbox',{name:'Your review',exact:true});
    const publish=reviews.getByRole('button',{name:'Publish review',exact:true});
    await expect(publish).toBeDisabled();
    await rating.getByRole('radio',{name:'4 stars',exact:true}).focus();
    await page.keyboard.press('Space');
    await expect(rating.getByRole('radio',{name:'4 stars',exact:true})).toBeChecked();
    await expect(rating.getByRole('radio',{checked:true})).toHaveCount(1);
    await comment.fill('Useful tools for our community.');
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-module-product-reference-${test.info().project.name}.png`,fullPage:true});
    let saved=page.waitForRequest(r=>r.url().includes('/reviews')&&r.method()==='POST');
    await publish.click();
    expect((await saved).postDataJSON()).toEqual({rating:4,comment:'Useful tools for our community.'});
    await expect(reviews.getByRole('button',{name:'Update review',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'4.0 · 1 review',exact:true})).toBeVisible();
    await rating.getByRole('radio',{name:'5 stars',exact:true}).click();
    await comment.fill('Updated: excellent tools.');
    saved=page.waitForRequest(r=>r.url().includes('/reviews')&&r.method()==='POST');
    await reviews.getByRole('button',{name:'Update review',exact:true}).click();
    expect((await saved).postDataJSON()).toEqual({rating:5,comment:'Updated: excellent tools.'});
    await expect(page.getByRole('link',{name:'5.0 · 1 review',exact:true})).toBeVisible();
    peers=11;
    await page.reload();
    await expect(comment).toHaveValue('Updated: excellent tools.');
    await reviews.getByRole('button',{name:'Next reviews',exact:true}).click();
    await expect(reviews.getByText('Installer feedback 10',{exact:true})).toBeVisible();
    await expect(comment).toHaveValue('Updated: excellent tools.');
    await reviews.getByRole('button',{name:'Previous reviews',exact:true}).click();
    await reviews.getByRole('button',{name:'Delete your review',exact:true}).click();
    const confirmation=page.getByRole('dialog',{name:'Delete your review?',exact:true});
    await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(comment).toHaveValue('Updated: excellent tools.');
    await reviews.getByRole('button',{name:'Delete your review',exact:true}).click();
    const removed=page.waitForRequest(r=>r.url().includes('/reviews')&&r.method()==='DELETE');
    await confirmation.getByRole('button',{name:'Delete review',exact:true}).click();
    expect((await removed).method()).toBe('DELETE');
    await expect(comment).toHaveValue('');
    await expect(publish).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const layout=await page.locator('[data-slot="module-product-layout"]').boundingBox();
    if(test.info().project.name==='desktop') {
      const preview=await page.getByRole('region',{name:'Module preview',exact:true}).boundingBox();
      const sidebar=await page.getByRole('complementary',{name:'Module installation and creator',exact:true}).boundingBox();
      expect(sidebar!.x).toBeGreaterThan(preview!.x+preview!.width);
      expect(preview!.width).toBeGreaterThan(layout!.width/2);
    }
  }
  expect(errors).toEqual([]);
});

test("module review access and failures stay readable and recoverable", async ({ page }) => {
  const errors=await mockDashboard(page);
  let unavailable=true;
  let canReview=false;
  await page.route(`**/api/dashboard/marketplace/${sampleModule.id}/reviews**`,route=>{
    if(route.request().method()==='POST') return route.fulfill({status:403,json:{error:'Your review access has changed.'}});
    return route.fulfill({status:unavailable?503:200,json:unavailable?{error:'Reviews temporarily unavailable.'}:{total:0,average:0,reviews:[],ownReview:null,hasMore:false,canReview,ownModule:false}});
  });
  await page.goto(`/dashboard/marketplace/${sampleModule.slug}`);
  const reviews=page.locator('#module-reviews');
  await expect(reviews.getByRole('alert')).toContainText('Reviews temporarily unavailable.');
  unavailable=false;
  await reviews.getByRole('button',{name:'Retry reviews',exact:true}).click();
  await expect(reviews.getByText('Install this module on a server you manage to leave a review.',{exact:true})).toBeVisible();
  await expect(reviews.getByRole('button',{name:'Publish review',exact:true})).toHaveCount(0);
  canReview=true;
  await page.reload();
  await reviews.getByRole('radiogroup',{name:'Your rating',exact:true}).getByRole('radio',{name:'3 stars',exact:true}).click();
  const comment=reviews.getByRole('textbox',{name:'Your review',exact:true});
  await comment.fill('Keep my draft after a failed save.');
  await reviews.getByRole('button',{name:'Publish review',exact:true}).click();
  await expect(reviews.getByRole('alert')).toContainText('Your review access has changed.');
  await expect(comment).toHaveValue('Keep my draft after a failed save.');
  await expect(reviews.getByRole('button',{name:'Publish review',exact:true})).toBeEnabled();
  expect(errors).toEqual([]);
});

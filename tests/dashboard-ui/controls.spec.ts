import { expect, test, type Page } from "@playwright/test";

const serverId = "123456789012345678";
const guild = { id: serverId, name: "UI Test Server", icon: null, permissions: "8", owner: true, hasBot: true };
const roles = [{ id: "role-1", name: "Verified Members", color: 0 }, { id: "role-2", name: "Moderators", color: 0 }];

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
    else if (pathname === "/api/dashboard/modules") body = { modules: [], installedCount: 0 };
    else if (pathname === "/api/dashboard/live-servers" || pathname === "/api/reports" || pathname === "/api/dashboard/logs") body = [];
    await route.fulfill({ json: body });
  });
  return errors;
}

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

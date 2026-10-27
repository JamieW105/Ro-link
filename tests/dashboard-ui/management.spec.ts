import { expect, test, type Page } from "@playwright/test";
import {
  defaultFeaturesContent,
  defaultPricingContent,
} from "../../lib/siteContent";

const role = {
  id: "role-1",
  name: "Moderators",
  permissions: ["RO_LINK_DASHBOARD", "MANAGE_SERVERS"],
};
const server = {
  id: "server-1",
  name: "Test community",
  member_count: 20,
  is_setup: true,
  owner_id: "owner-1",
  icon: null,
};
const job = {
  id: "job-1",
  title: "Community moderator",
  description: "Help our community.",
  requirements: "Clear communication.",
  tags: [],
  questions: [],
  status: "OPEN",
  created_at: "2026-10-20T00:00:00Z",
};
const addon = {
  id: "module-1",
  slug: "welcome",
  name: "Welcome",
  description: "Welcome players.",
  version: "1.0",
  category: "Community",
  status: "PUBLISHED",
  isOfficial: false,
  sourceCode: "return {}",
  sourceChecksum: "fixture",
  configSchema: {},
  authorDiscordId: "creator-1",
  moderationNote: "",
  creatorHistory: [],
};
const post = {
  id: "post-1",
  slug: "update",
  title: "October update",
  description: "Release notes.",
  status: "DRAFT",
  version: "1.0",
  major_features: [],
  minor_updates: [],
  qol_updates: [],
  bug_fixes: [],
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
};

async function mockManagement(
  page: Page,
  permissions = ["RO_LINK_DASHBOARD", "MANAGE_RO_LINK"],
) {
  const errors: string[] = [];
  const mutations: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    errors.push(`Native dialog: ${dialog.message()}`);
    await dialog.dismiss();
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (!["GET", "HEAD"].includes(request.method()))
      mutations.push(`${request.method()} ${pathname}`);
    let body: unknown = [];
    if (pathname === "/api/auth/session")
      body = {
        user: { id: "management-tester", name: "UI Tester", image: null },
        expires: "2099-01-01T00:00:00Z",
      };
    else if (pathname === "/api/custom-dashboard/resolve")
      body = { isCustomDashboard: false };
    else if (pathname === "/api/site-banners") body = { banners: [] };
    else if (pathname === "/api/management/check") body = { permissions };
    else if (pathname === "/api/management/stats")
      body = {
        totalServers: 12,
        activeApplications: 2,
        totalSubmissions: 6,
        blockedServers: 1,
      };
    else if (pathname === "/api/management/roles") body = [role];
    else if (pathname === "/api/management/users")
      body = [
        { discord_id: "staff-1", role, added_at: "2026-10-20T00:00:00Z" },
      ];
    else if (pathname === "/api/management/servers") body = [server];
    else if (pathname === "/api/management/jobs") body = [job];
    else if (pathname === "/api/management/jobs/job-1/details") body = job;
    else if (pathname === "/api/management/jobs/job-1/submissions") body = [];
    else if (pathname === "/api/management/modules") body = [addon];
    else if (pathname === "/api/management/modules/module-1") body = addon;
    else if (pathname === "/api/management/posts") body = [post];
    else if (pathname === "/api/management/posts/post-1") body = post;
    else if (pathname === "/api/management/dms")
      body = {
        counts: {
          verifiedLinkedUsers: 2,
          serverOwnersAll: 1,
          serverOwnersSetup: 1,
          serverOwnersWithoutSetup: 0,
        },
      };
    else if (pathname === "/api/management/site-content/features")
      body = defaultFeaturesContent;
    else if (pathname === "/api/management/site-content/pricing")
      body = defaultPricingContent;
    await route.fulfill({ json: body });
  });
  return { errors, mutations };
}

async function toggleTheme(page: Page, theme: "light" | "dark") {
  const toggle = page.getByRole("button", { name: /Switch to .* mode/ });
  await expect(toggle).toBeEnabled();
  if ((await toggle.getAttribute("aria-label")) === `Switch to ${theme} mode`)
    await toggle.click();
  await expect(page.locator(".management-shell")).toHaveCSS(
    "color-scheme",
    theme,
  );
  // Compare rendered token colors, not only the dark class.
  expect(
    await page.locator(".management-shell").evaluate((shell, dark) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      function pixel(color: string) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].join(",");
      }
      const styles = getComputedStyle(shell);
      const card = shell.querySelector(
        '[data-slot="card"], [data-slot="stat"]',
      );
      return (
        pixel(styles.backgroundColor) ===
          pixel(dark ? "oklch(0.145 0 0)" : "oklch(1 0 0)") &&
        pixel(styles.color) ===
          pixel(dark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)") &&
        (!card ||
          pixel(getComputedStyle(card).backgroundColor) ===
            pixel(dark ? "oklch(0.205 0 0)" : "oklch(1 0 0)"))
      );
    }, theme === "dark"),
  ).toBe(true);
}

test("management pages use Dice surfaces, labeled controls and both themes", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { errors } = await mockManagement(page);
  for (const route of [
    "",
    "/servers",
    "/jobs",
    "/jobs/new",
    "/jobs/job-1/edit",
    "/jobs/job-1/submissions",
    "/posts",
    "/posts/new",
    "/posts/post-1/edit",
    "/site-banners",
    "/pricing",
    "/pricing/new",
    "/features",
    "/features/new",
    "/dms",
    "/modules",
    "/modules/module-1",
    "/blocking",
    "/people",
  ]) {
    await page.goto(`/management${route}`);
    await expect(page.locator("main h1")).toBeVisible();
    for (const theme of ["light", "dark"] as const) {
      await toggleTheme(page, theme);
      if (route === "" || route === "/people")
        await page.screenshot({
          path: test
            .info()
            .outputPath(
              `management-${route ? "people" : "overview"}-${theme}.png`,
            ),
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator("main")
          .evaluate((main) =>
            [
              ...main.querySelectorAll(
                "input:not([type=hidden]):not([aria-hidden=true]), textarea, select",
              ),
            ]
              .filter(
                (control) =>
                  !(control as HTMLInputElement).labels?.length &&
                  !control.getAttribute("aria-label") &&
                  !control.getAttribute("aria-labelledby"),
              )
              .map((control) => control.outerHTML),
          ),
      ).toEqual([]);
      await expect(page.locator("main button:not([type])")).toHaveCount(0);
      await expect(
        page.locator(
          "main select, main input[type=checkbox]:not([aria-hidden=true])",
        ),
      ).toHaveCount(0);
    }
  }
  expect(errors).toEqual([]);
});

test("management permissions and short mobile navigation remain usable", async ({
  page,
}) => {
  const { errors } = await mockManagement(page, [
    "RO_LINK_DASHBOARD",
    "POST_JOB_APPLICATION",
  ]);
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto("/management");
  await expect(
    page.getByRole("heading", { name: "Management Overview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("link", { name: "Job Apps", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "People", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("role removal requires themed confirmation and supports keyboard cancellation", async ({
  page,
}) => {
  const { errors, mutations } = await mockManagement(page);
  await page.goto("/management/people");
  const remove = page.getByRole("button", { name: "Remove item" });
  await expect(remove).toBeVisible();
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Confirm action" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(mutations).toEqual([]);
  await remove.click();
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect
    .poll(() => mutations)
    .toEqual(["DELETE /api/management/users/staff-1"]);
  expect(errors).toEqual([]);
});

test("banner editing uses a themed dialog and submits only the save action", async ({
  page,
}) => {
  const { errors, mutations } = await mockManagement(page);
  await page.goto("/management/site-banners");
  await page.getByRole("button", { name: "New banner", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Title", { exact: true }).fill("Maintenance");
  await dialog.getByLabel("Message", { exact: true }).fill("A test notice.");
  await dialog.getByRole("button", { name: /Public Pages/ }).click();
  expect(mutations).toEqual([]);
  await dialog
    .getByRole("button", { name: "Create banner", exact: true })
    .click();
  await expect
    .poll(() => mutations)
    .toEqual(["POST /api/management/site-banners"]);
  expect(errors).toEqual([]);
});

test("module moderation reasons use Dice inputs and cancellation sends no mutation", async ({
  page,
}) => {
  const { errors, mutations } = await mockManagement(page);
  await page.goto("/management/modules/module-1");
  await page.getByRole("button", { name: /Block Creator/i }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm action" });
  await expect(dialog.getByLabel("Reason")).toHaveValue(
    "Repeated module terms violations.",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(mutations).toEqual([]);
  await page.getByRole("button", { name: /Block Creator/i }).click();
  await dialog.getByLabel("Reason").fill("Repeated submission violations.");
  const sent = page.waitForRequest(
    (request) =>
      request.url().includes("/api/management/module-creator-blocks") &&
      request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  expect((await sent).postDataJSON()).toMatchObject({
    discordId: "creator-1",
    reason: "Repeated submission violations.",
    active: true,
  });
  expect(errors).toEqual([]);
});

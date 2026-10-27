# Ro-Link agent guidance

## UI library for every feature change

Use [Dice UI](https://diceui.com/) for all new or changed feature UI, including
public pages, documentation, authentication, server dashboards, settings, live panels, modules, marketplace, custom dashboards,
and management screens. This requirement applies to future feature changes too. Marketplace modules must have real product pages at
`/dashboard/marketplace/[moduleSlug]`; preserve deep links and the installation flow.

- Reuse the local components in `components/ui` before adding a new control.
  Dice UI extends shadcn/ui: use the shared shadcn-compatible Button, Input,
  Textarea, Checkbox, Switch, Separator, and Table foundations with Dice components.
- For advanced interactions, consult the current Dice docs and install/copy the
  official registry component (`https://diceui.com/r/<component>.json`). Keep the
  source URL in copied files, adapt imports to `@/components/ui` and `@/lib/utils`,
  and add the actual required dependencies. Do not imitate a Dice component with
  bespoke markup or introduce a competing component library.
- Use `Select` from `components/ui/select.tsx` for searchable single selections.
  Pass string domain values, `options`, `onValueChange`, and a descriptive
  `aria-label`. Empty values mean None/Disabled; the adapter handles Dice's
  nonempty item requirement internally. Preserve option groups and disabled states.
- Use Dice `Stat`, `StatLabel`, `StatValue`, `StatIndicator`, and `StatDescription`
  for dashboard metrics. Use Dice components for other applicable advanced UI
  (dialogs, tables, uploads, color pickers, steppers, and similar interactions).
- Use Dice UI's neutral light and dark themes and semantic tokens across every dashboard.
  Both modes are required for all new and changed UI. Reuse ThemeToggle and the
  next-themes provider; persist the choice with `rolink-theme`. Never hard-code a
  light-only or dark-only page. Check surfaces, text, borders, popups and status
  colors in both modes, including Live Panel and marketplace products.
  Use Card for page panels, Dice Stat for metrics, and Dice Status for state labels.
  Use Button variants (`default`, `outline`, `secondary`, `ghost`, `destructive`)
  and the shared controls' standard sizing. Never restore legacy unstyled wrappers,
  navy/sky gradients, neon glows, oversized controls, all-caps headings, or global
  CSS that overrides component styling. Feature UI must visibly follow Dice's theme.
  Use `type="submit"` for submissions and `type="button"` for other form actions.
- Multiline Live Panel command suggestions must use content-sized rows with clear
  vertical padding and spacing; do not constrain titles and descriptions to the
  standard single-line Button height. Omit redundant CMD/Cmds badges and use the
  shared Dice Status for category and user labels in both themes.
- Keep the colored main icon in the page heading. Do not repeat the page icon in
  panel headers or add decorative icon badges/watermarks inside those panels.
  Use CardHeader, CardTitle, CardDescription, and CardContent for panel structure;
  retain icons that communicate actions, metrics, identity, or meaningful states.
- Use Lucide (`lucide-react`) for all interface icons. Import icons directly; do
  not add hand-drawn SVGs, emoji icons, or another icon pack. Keep `iconLibrary`
  set to `lucide` in `components.json`.
- Keep semantic token mappings in `app/globals.css` and the complete light/dark
  palette in `components/dashboard/theme.module.css`. Use DashboardTheme for route
  boundaries and apply its theme class to standalone shells and portaled dialogs.
  Do not inherit dashboard colors from `:root`. Verify actual computed background,
  card, text, and button colors after toggling, not just the `dark` class. Preserve custom-dashboard
  branding and semantic accent tokens. Portal content must inherit the active dashboard theme. Preserve
  responsive layouts, permissions, loading/error states, and API behavior.
- Label interactive controls, retain visible keyboard focus, use Checkbox/Switch
  semantics, and verify keyboard selection, disabled states, and mobile layouts.
  Role settings must use the shared Checkbox for individual permissions and commands,
  Card sections, Dice Status counts, and a themed Dialog for removal. Do not use
  custom checkmark boxes or browser confirmation popups for role management.
  In Live Panel, use the shared Dialog for commands, announcements, and confirmations,
  DropdownMenu for server/player actions, and Table for moderation activity.
  Marketplace cards and products use shared Card sections and Dice Status badges;
  configuration previews use Table. Marketplace listing cards use a 16:9 preview,
  compact title/description, and creator/category footer. Use one column on phones, two on small tablets, and three from 768px.
  From 1024px, use an adaptive grid with a 280px minimum card width and compact
  spacing: prioritize readable card widths, with four across on typical laptops,
  five on larger laptops, and more on wider screens.
  Let the listing use the available width; do not cap it at max-w-7xl.
  Product pages use a preview/about/configuration/reviews column and an install/creator
  sidebar. Use the official Dice Rating component for ratings. Review identity and
  creator/installer eligibility must be enforced by the API; never trust client-supplied
  reviewer IDs or permissions. Keep review tables/RPCs service-role-only and document
  required migrations.
  Module covers use the official Dice FileUpload and Sortable controls. Accept up
  to four JPG/PNG/WebP images of up to 9 MB each; compress before upload and re-encode
  on the server to WebP at 2 MB or less. Keep the ordered cover paths in `cover_images`;
  verify each belongs to the authenticated creator. Store files in the private
  `module-covers` bucket. The first image is the listing cover; the product preview
  shows selectable thumbnails and the neutral Package placeholder when empty.
  Keep installation multi-select visible with
  Switch and Checkbox controls, including disabled server-limit states.
  Specialized native inputs (color, number, file, etc.) may use the shared Input;
  do not replace domain behavior merely to change presentation.

## Public pages

Use `PublicThemeGate` with the same local Dice palette and persistent ThemeToggle
for public routes. Keep the public header, footer, notices, documentation, sign-in,
Studio connection, verification, reports, careers, posts, and policy pages readable
in both themes. Preserve public content, links, authentication callbacks, forms,
validation, and custom-dashboard branding. Use shared Dice controls and Card panels;
`app/public-theme.css` is for public layout and typography, not alternate component
skins. Do not restore the old fixed dark palette, blue gradients, rotating hero
backgrounds, bespoke dropdowns, or custom search overlays. Documentation search uses
the shared Dialog, and its data tables use the shared Table components.
Run `npm run test:dashboard-ui -- public.spec.ts` for public UI changes. The suite
checks both themes on desktop/mobile, public navigation, documentation search,
and report, appeal, and career form payloads using mocked service responses.

## Dashboard navigation

The creator dashboard at `/dashboard/creator/modules` opens to all modules as
full-width cards. Keep editing on `/dashboard/creator/modules/[moduleId]/edit`
and creation on `/dashboard/creator/modules/new`, with a return link to the library.
Do not automatically select a module or show an editor beside the default list.

Keep the Live Panel page at `/dashboard/[id]/live-panel` and its permission-aware
entry from the overview. Do not add Live Servers, Live Panel, Player Lookup,
Reports, or Misc Actions to the sidebar. Standalone `servers`, `lookup`, `reports`
(including report details), and `misc` pages have been retired; operational tools
remain in Live Panel. Report configuration under `settings/reports` is separate.

Staff Shifts and its dedicated settings page must retain permission-aware entry
points and Dice light/dark styling. Keep shift-view and shift-management permissions
separate; management alone must not expose staff history. Preserve the personal
shift summary in Live Panel and the existing tracking and Discord command behavior.

Server dashboards must stay within the viewport, including site notices. Scroll
page content and sidebar navigation independently; keep the header, account footer,
and dashboard footer visible. Do not add document scrolling or nested viewport
heights. Check short desktop/mobile windows with and without notice banners.

## Validation

Run `npm run typecheck`, `npm run lint`, and `npm run build` for UI migrations.
Run the targeted browser checks with `npm run test:dashboard-ui` when changing
shared dashboard controls. Report existing failures separately from regressions.
Do not expose credentials in logs, screenshots, or test fixtures.

## Compliance review — 27 October 2026 (PR #23)

The review found and corrected these gaps in the Dice migration:

| Flag | Required implementation |
| --- | --- |
| Management screens retained dark-only colors and custom controls | Keep the management shell, loading/access states, editors, and lists inside the local Dice theme. Use shared controls, Card structure, Stat metrics, Status labels, and Table configuration previews. |
| Management navigation and overlays lacked the shared dashboard behavior | Keep the header/footer visible and scroll navigation/content independently. Mobile navigation, banner editing, and server removal use themed Dialog content with keyboard dismissal and focus handling. |
| Browser popups interrupted actions; native moderation prompts continued after cancellation | Use `useDashboardFeedback` for confirmations, reason prompts, and notifications. A cancelled reason prompt must return before rejecting a module or blocking a creator. Await confirmation before sending a mutation; cancellation must send no request. Preserve existing purpose-built feature dialogs. |
| Several fields lacked accessible names or explicit button intent | Label controls, preserve domain values through the shared searchable Select, and set button types explicitly. Use standard Button variants and sizing; multiline selection rows may grow to fit their content. |
| Custom-module creation/reupload returned the wrong response value | Return the saved normalized custom module under `module`, retaining status codes, settings authorization, and source-code redaction. |
| Runtime-log refresh could retain an outdated callback | Keep callback/effect dependencies current when the guild or runtime-log permission changes. |
| UI tests still expected retired command buttons and raced repeated saves | Test role commands as Checkboxes, measure tick contrast against the checkbox surface, and await save completion before advancing the test clock. |

Regression coverage includes `tests/dashboard-ui/management.spec.ts` for management
screens in both themes, desktop/mobile layouts, labeled controls, permissions,
confirmation cancellation, and banner submission. `npm run test:custom-modules`
checks create/reupload response contracts and denied access using an isolated
adapter, without writing to a live database. Run these alongside the existing
validation commands above. When running separate Playwright processes, give each
a distinct `--output` directory to avoid trace-file collisions.

Remaining baseline flags: ESLint reports pre-existing unused bindings and native
image optimization warnings in legacy API, bot, authentication, and image-rendering
paths. These warnings are separate from Dice compliance and must not be hidden by
disabling lint rules. Browser tests use mocked service responses; they do not
certify live Discord/Roblox delivery or database policies.

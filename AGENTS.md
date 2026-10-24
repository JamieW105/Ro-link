# Ro-Link agent guidance

## UI library for every feature change

Use [Dice UI](https://diceui.com/) for all new or changed feature UI, including
server dashboards, settings, live panels, modules, marketplace, custom dashboards,
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
  Specialized native inputs (color, number, file, etc.) may use the shared Input;
  do not replace domain behavior merely to change presentation.

## Dashboard navigation

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

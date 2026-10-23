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
  colors in both modes, including Servers, Live Panel and marketplace products.
  Use Card for page panels, Dice Stat for metrics, and Dice Status for state labels.
  Use Button variants (`default`, `outline`, `secondary`, `ghost`, `destructive`)
  and the shared controls' standard sizing. Never restore legacy unstyled wrappers,
  navy/sky gradients, neon glows, oversized controls, all-caps headings, or global
  CSS that overrides component styling. Feature UI must visibly follow Dice's theme.
  Use `type="submit"` for submissions and `type="button"` for other form actions.
- Use Lucide (`lucide-react`) for all interface icons. Import icons directly; do
  not add hand-drawn SVGs, emoji icons, or another icon pack. Keep `iconLibrary`
  set to `lucide` in `components.json`.
- Keep semantic theme tokens in `app/globals.css` and preserve custom-dashboard
  branding and semantic accent tokens. Portal content must inherit the active dashboard theme. Preserve
  responsive layouts, permissions, loading/error states, and API behavior.
- Label interactive controls, retain visible keyboard focus, use Checkbox/Switch
  semantics, and verify keyboard selection, disabled states, and mobile layouts.
  Specialized native inputs (color, number, file, etc.) may use the shared Input;
  do not replace domain behavior merely to change presentation.

## Validation

Run `npm run typecheck`, `npm run lint`, and `npm run build` for UI migrations.
Run the targeted browser checks with `npm run test:dashboard-ui` when changing
shared dashboard controls. Report existing failures separately from regressions.
Do not expose credentials in logs, screenshots, or test fixtures.

# Ro-Link agent guidance

## UI library for every feature change

Use [Dice UI](https://diceui.com/) for all new or changed feature UI, including
server dashboards, settings, live panels, modules, marketplace, custom dashboards,
and management screens. This requirement applies to future feature changes too.

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
- Use the default Button variants for new actions. `variant="unstyled"` and
  `size="unstyled"` exist for migrated actions that already supply their own
  layout and semantic colors. Preserve explicit `type="submit"` in forms and
  use `type="button"` for actions that must not submit a form.
- Keep semantic theme tokens in `app/globals.css` and preserve custom-dashboard
  colors. Portal content must inherit the active dashboard theme. Preserve
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

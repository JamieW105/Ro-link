"use client";

// shadcn/ui foundation used by Dice UI. Adapted from:
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/dropdown-menu.tsx
import { Menu } from "@base-ui/react/menu";
import themeStyles from "@/components/dashboard/theme.module.css";
import { cn } from "@/lib/utils";

const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;
const DropdownMenuGroup = Menu.Group;

function DropdownMenuContent({
  className,
  anchor,
  ...props
}: Menu.Popup.Props & Pick<Menu.Positioner.Props, "anchor">) {
  return (
    <Menu.Portal>
      <Menu.Positioner anchor={anchor} align="start" sideOffset={4} className="z-[180] outline-none">
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            themeStyles.theme,
            "dice-ui-dashboard max-h-[var(--available-height)] min-w-48 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({ className, ...props }: Menu.Item.Props) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }: Menu.GroupLabel.Props) {
  return <Menu.GroupLabel data-slot="dropdown-menu-label" className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuGroup };

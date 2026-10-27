"use client";

import { useMemo, useRef, useState } from "react";
import {
  Combobox, ComboboxAnchor, ComboboxContent, ComboboxEmpty,
  ComboboxGroup, ComboboxGroupLabel, ComboboxInput, ComboboxItem, ComboboxTrigger,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

type SelectOption = { value: string; label: string; disabled?: boolean; group?: string };
type SelectProps = {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  "aria-label": string;
  "aria-describedby"?: string;
};

// Keep domain values (including "" for Disabled/None) at the call site.
// Dice requires nonempty item values, so encode every option without collisions.
const encodeValue = (value: string) => `value:${value}`;

function Select({ options, value, onValueChange, disabled, className, id, name, "aria-label": label, "aria-describedby": describedBy }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const groups = [...new Set(options.map((option) => option.group))];
  const labels = useMemo(() => new Map(options.map((option) => [encodeValue(option.value), option.label.toLocaleLowerCase()])), [options]);

  function renderOption(option: SelectOption) {
    return <ComboboxItem key={option.value} value={encodeValue(option.value)} label={option.label} disabled={option.disabled}>{option.label}</ComboboxItem>;
  }

  return (
    <div ref={rootRef} className="min-w-0 flex-1">
      <Combobox
        value={encodeValue(value)}
        onValueChange={(next) => onValueChange(next.slice("value:".length))}
        inputValue={open ? search : selected?.label ?? ""}
        onInputValueChange={setSearch}
        open={open}
        onOpenChange={(next) => {
          if (next) setContainer(rootRef.current?.closest<HTMLElement>(".custom-dashboard-shell, .dice-ui-dashboard") ?? null);
          setOpen(next);
          setSearch("");
        }}
        onFilter={(values, term) => values.filter((encoded) => {
          return labels.get(encoded)?.includes(term.toLocaleLowerCase()) ?? false;
        })}
        disabled={disabled}
        openOnFocus
        autoHighlight
      >
        <ComboboxAnchor className={cn("h-auto min-h-9 bg-background px-3 py-2", className)}>
          <ComboboxInput id={id} aria-label={label} aria-labelledby={undefined} aria-describedby={describedBy} placeholder={selected?.label ?? "Select an option…"} className="h-auto min-w-0 text-inherit" />
          <ComboboxTrigger type="button" aria-label={`Show ${label.toLowerCase()} options`} />
        </ComboboxAnchor>
        <ComboboxContent container={container} strategy="fixed" className="z-[150] max-w-[calc(100vw-2rem)] border-border">
          <ComboboxEmpty>No options found.</ComboboxEmpty>
          {groups.map((group) => group ? (
            <ComboboxGroup key={group}>
              <ComboboxGroupLabel>{group}</ComboboxGroupLabel>
              {options.filter((option) => option.group === group).map(renderOption)}
            </ComboboxGroup>
          ) : options.filter((option) => !option.group).map(renderOption))}
        </ComboboxContent>
        {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      </Combobox>
    </div>
  );
}

export { Select, type SelectOption, type SelectProps };

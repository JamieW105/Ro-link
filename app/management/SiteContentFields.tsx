"use client";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Status } from "@/components/ui/status";

export function EditorField({
  label,
  value,
  onChange,
  multiline = false,
  maxLength,
  placeholder,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
}) {
  const classes = "w-full";
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      {multiline ? (
        <Textarea
          required={required}
          rows={4}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${classes} resize-y`}
        />
      ) : (
        <Input
          required={required}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={classes}
        />
      )}
    </label>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      <span>
        {label}
        {description && (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export function StatusMessage({
  message,
}: {
  message: { type: "error" | "success"; text: string } | null;
}) {
  if (!message) return null;
  return (
    <Status
      role={message.type === "error" ? "alert" : "status"}
      variant={message.type === "error" ? "error" : "success"}
      className="w-full whitespace-normal rounded-md px-4 py-3"
    >
      {message.text}
    </Status>
  );
}

export function LoadingState() {
  return (
    <div className="flex min-h-56 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent" />
    </div>
  );
}

"use client";

import { Children, isValidElement, useState, type ComponentProps, type FormEvent, type ReactElement, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, X } from "@/components/icons/duo";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import styles from "./dialog-kit.module.css";

export { styles as dialogKitStyles };

/**
 * The app's form dialog: header (icon, title, subtitle, close), a scrolling body, and a
 * footer of standard buttons. With `onSubmit` the body is a form and `footer` buttons
 * can submit it via `form={formId}`.
 */
export function KitDialog({ open, onOpenChange, title, description, icon, width, busy = false, formId, onSubmit, footer, children, contentProps, closeLabel = "Close", onBack }: {
  closeLabel?: string; onBack?: () => void; open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; icon?: ReactNode;
  width?: "narrow" | "wide"; busy?: boolean; formId?: string; onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  footer?: ReactNode; children: ReactNode; contentProps?: Partial<ComponentProps<typeof DialogContent>>;
}) {
  const body = onSubmit
    ? <form id={formId} className={styles.body} onSubmit={event => { event.preventDefault(); onSubmit(event); }}>{children}</form>
    : <div className={styles.body}>{children}</div>;
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent hideClose data-width={width} {...contentProps} className={cn("lab-dialog-surface", styles.surface, contentProps?.className)}
      onInteractOutside={event => { if (busy) event.preventDefault(); contentProps?.onInteractOutside?.(event); }}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); contentProps?.onEscapeKeyDown?.(event); }}>
      <header className={styles.head}>
        {onBack ? <button type="button" className={styles.close} aria-label="Back" onClick={onBack}><ChevronLeft aria-hidden="true"/></button> : null}
        {icon ? <span className={styles.headIcon} aria-hidden="true">{icon}</span> : null}
        <div className={styles.headCopy}>
          <DialogTitle className={styles.title}>{title}</DialogTitle>
          {description ? <DialogDescription className={styles.subtitle}>{description}</DialogDescription> : null}
        </div>
        <button type="button" className={styles.close} aria-label={closeLabel} disabled={busy} onClick={() => onOpenChange(false)}><X aria-hidden="true"/></button>
      </header>
      {body}
      {footer ? <footer className={cn("lab-dialog-footer", styles.footer)}>{footer}</footer> : null}
    </DialogContent>
  </Dialog>;
}

/** Footer contents: an optional message line, then equal-width buttons (kitCancelClass / kitPrimaryClass). */
export function KitFooter({ error, notice, children }: { error?: ReactNode; notice?: ReactNode; children: ReactNode }) {
  return <>
    {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
    {notice ? <p role="status" className={styles.status}>{notice}</p> : null}
    <div className={styles.actions}>{children}</div>
  </>;
}

/* The original Lab dialog buttons (globals.css .lab-secondary / .lab-primary), as in the
   VibeGhost and MCP dialogs: recessed near-black Cancel, raised primary, 38px, monospace. */
const kitButtonBase = "w-full min-w-0 font-mono text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-45";
export const kitCancelClass = `lab-secondary ${kitButtonBase}`;
export const kitPrimaryClass = `lab-primary ${kitButtonBase}`;
/** The primary button while confirming a delete. */
export const kitDangerClass = `${kitPrimaryClass} ${styles.danger}`;
/** A labelled destructive text button for a dialog body ("Delete project"). */
export const kitDangerLinkClass = styles.dangerLink;

/** A captioned recessed band. */
export function KitSection({ caption, children, className }: { caption?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn(styles.section, className)}>
    {caption ? <span className={styles.caption}>{caption}</span> : null}
    <div className={styles.group}>{children}</div>
  </section>;
}

/** Label over a full-width control, inside a section. */
export function KitField({ label, hint, htmlFor, children }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return <div className={styles.field}>
    {htmlFor ? <label htmlFor={htmlFor} className={styles.fieldLabel}>{label}</label> : <span className={styles.fieldLabel}>{label}</span>}
    {children}
    {hint ? <span className={styles.hint}>{hint}</span> : null}
  </div>;
}

/** Label (and hint) on the left, a compact control on the right. */
export function KitRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return <div className={styles.row}><span className={styles.rowLabel}>{label}{hint ? <span className={styles.hint}>{hint}</span> : null}</span>{children}</div>;
}

/** Two fields side by side from 520px, stacked below. */
export function KitPair({ children }: { children: ReactNode }) { return <div className={styles.pair}>{children}</div>; }

export function KitNote({ children }: { children: ReactNode }) { return <p className={styles.note}>{children}</p>; }
export const kitInputClass = styles.input;

/* Radix Select reserves "" for "no value", so an <option value=""> travels under this key. */
const EMPTY_OPTION = "__kit-empty";
type KitOption = { value: string; label: ReactNode; disabled?: boolean };
function kitOptions(children: ReactNode, out: KitOption[] = []): KitOption[] {
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (element.type === "option") out.push({ value: String(element.props.value ?? ""), label: element.props.children, disabled: element.props.disabled });
    else kitOptions(element.props.children, out);
  });
  return out;
}

/**
 * The kit's select: a drop-in for `<select className={kitInputClass}>` that keeps the same
 * `<option>` children and `onChange(event.target.value)` contract, but opens the shared
 * shadcn/Lab menu instead of the platform picker.
 */
export function KitSelect({ id, value, onChange, disabled, className, children, "aria-label": ariaLabel }: {
  id?: string; value: string | number; onChange: (event: { target: { value: string } }) => void; disabled?: boolean;
  className?: string; children: ReactNode; "aria-label"?: string;
}) {
  const options = kitOptions(children);
  const current = String(value);
  return <Select value={current === "" ? EMPTY_OPTION : current} disabled={disabled} onValueChange={next => onChange({ target: { value: next === EMPTY_OPTION ? "" : next } })}>
    <SelectTrigger id={id} aria-label={ariaLabel} className={cn(styles.input, styles.selectTrigger, className)}><SelectValue/></SelectTrigger>
    <SelectContent position="popper" sideOffset={6} collisionPadding={12} className={styles.selectMenu}>
      {options.map(option => <SelectItem key={option.value || EMPTY_OPTION} value={option.value || EMPTY_OPTION} disabled={option.disabled}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromDateKey = (key: string) => { const [y, m, d] = key.split("-").map(Number); return y && m && d ? new Date(y, m - 1, d) : undefined; };
const dateLabel = (key: string) => fromDateKey(key)?.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const timeLabel = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);

/** The kit's date field: a `YYYY-MM-DD` value in the same well, opening the shared
 *  shadcn Popover + Calendar instead of the platform date picker. */
export function KitDate({ id, value, onChange, disabled, placeholder = "Pick a date", className, "aria-label": ariaLabel }: {
  id?: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string; className?: string; "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromDateKey(value);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild disabled={disabled}>
      <button type="button" id={id} aria-label={ariaLabel} data-state={open ? "open" : "closed"} className={cn(styles.input, styles.selectTrigger, className)}>
        <span data-placeholder={selected ? undefined : true}>{selected ? dateLabel(value) : placeholder}</span><CalendarDays aria-hidden="true" className="size-4"/>
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={6} collisionPadding={12} className={styles.dateMenu}>
      <Calendar mode="single" selected={selected} defaultMonth={selected} onSelect={date => { if (date) { onChange(toDateKey(date)); setOpen(false); } }} autoFocus/>
    </PopoverContent>
  </Popover>;
}

/** The kit's time field: an `HH:MM` value picked from quarter hours in the shared Select menu.
 *  An off-grid stored time stays selectable; `emptyLabel` adds a "no time" choice. */
export function KitTime({ id, value, onChange, disabled, emptyLabel, className, "aria-label": ariaLabel }: {
  id?: string; value: string; onChange: (value: string) => void; disabled?: boolean; emptyLabel?: string; className?: string; "aria-label"?: string;
}) {
  const times = value && !QUARTER_HOURS.includes(value) ? [...QUARTER_HOURS, value].sort() : QUARTER_HOURS;
  return <KitSelect id={id} aria-label={ariaLabel} value={value} disabled={disabled} className={className} onChange={event => onChange(event.target.value)}>
    {emptyLabel !== undefined || !value ? <option value="">{emptyLabel ?? "Pick a time"}</option> : null}
    {times.map(time => <option key={time} value={time}>{timeLabel(time)}</option>)}
  </KitSelect>;
}

/** A local `YYYY-MM-DDTHH:MM` value (the `datetime-local` format) as a date and a time field. */
export function KitDateTime({ id, value, onChange, disabled }: { id?: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [date = "", time = ""] = value.split("T");
  const update = (nextDate: string, nextTime: string) => onChange(nextDate ? `${nextDate}T${nextTime || "09:00"}` : "");
  return <div className={styles.dateTime}>
    <KitDate id={id} value={date} disabled={disabled} onChange={next => update(next, time || "09:00")}/>
    <KitTime aria-label="Time" value={time} disabled={disabled || !date} onChange={next => update(date, next)}/>
  </div>;
}

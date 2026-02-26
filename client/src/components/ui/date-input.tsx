import * as React from "react";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

interface DateInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

function isValidDate(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value = "", onChange, onBlur, name, className, disabled, ...props }, ref) => {
    const hiddenDateRef = React.useRef<HTMLInputElement>(null);
    const [displayValue, setDisplayValue] = React.useState("");

    React.useEffect(() => {
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split("-");
        setDisplayValue(`${d}/${m}/${y}`);
      } else if (!value) {
        setDisplayValue("");
      }
    }, [value]);

    const formatAsTyping = (raw: string): string => {
      const digits = raw.replace(/\D/g, "").slice(0, 8);
      if (digits.length <= 2) return digits;
      if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    };

    const toISODate = (display: string): string => {
      const digits = display.replace(/\D/g, "");
      if (digits.length === 8) {
        const d = digits.slice(0, 2);
        const m = digits.slice(2, 4);
        const y = digits.slice(4, 8);
        const day = parseInt(d, 10);
        const month = parseInt(m, 10);
        const year = parseInt(y, 10);
        if (isValidDate(day, month, year)) {
          return `${y}-${m}-${d}`;
        }
      }
      return "";
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatAsTyping(e.target.value);
      setDisplayValue(formatted);
      const iso = toISODate(formatted);
      if (iso && onChange) {
        onChange(iso);
      }
    };

    const handleBlur = () => {
      const iso = toISODate(displayValue);
      if (!iso && displayValue.replace(/\D/g, "").length > 0) {
        if (onChange) onChange("");
      }
      if (onBlur) onBlur();
    };

    const handleCalendarClick = () => {
      if (disabled) return;
      hiddenDateRef.current?.showPicker?.();
      hiddenDateRef.current?.focus();
      hiddenDateRef.current?.click();
    };

    const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val && onChange) {
        onChange(val);
      }
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          name={name}
          value={displayValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder="DD/MM/AAAA"
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          data-testid={props["data-testid"]}
        />
        <button
          type="button"
          onClick={handleCalendarClick}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          tabIndex={0}
          aria-label="Abrir calendário"
        >
          <Calendar className="h-4 w-4" />
        </button>
        <input
          ref={hiddenDateRef}
          type="date"
          value={value || ""}
          onChange={handleNativeDateChange}
          className="sr-only absolute"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    );
  }
);

DateInput.displayName = "DateInput";

export { DateInput };

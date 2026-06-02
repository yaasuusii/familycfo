import { useState } from "react";
import { cn } from "@/lib/utils";
import { Bell, ShieldAlert, AlertTriangle, ChevronDown, X } from "lucide-react";

export type AlertSeverity = "critical" | "warning";

export interface AlertItem {
  severity: AlertSeverity;
  message: string;
}

const sevColor: Record<AlertSeverity, string> = {
  critical: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
};

const sevIcon: Record<AlertSeverity, typeof ShieldAlert> = {
  critical: ShieldAlert,
  warning: AlertTriangle,
};

/**
 * Top notification bar. Collapses to a single pill (bell + count + first
 * message). Tap to expand full list. Dismissible for the session.
 * Tone follows the most severe alert.
 */
export function NotificationBar({ alerts }: { alerts: AlertItem[] }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (alerts.length === 0 || dismissed) return null;

  const hasCritical = alerts.some((a) => a.severity === "critical");
  const tone = hasCritical ? sevColor.critical : sevColor.warning;
  const tint = `color-mix(in oklab, ${tone} 12%, transparent)`;
  const border = `color-mix(in oklab, ${tone} 34%, transparent)`;

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ background: tint, borderColor: border }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: `color-mix(in oklab, ${tone} 18%, transparent)` }}>
          <Bell className="h-4 w-4" style={{ color: tone }} />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ background: tone }}>
            {alerts.length}
          </span>
        </span>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="truncate text-sm font-medium" style={{ color: tone }}>
            {alerts.length === 1 ? alerts[0].message : `${alerts.length} alerts need attention`}
          </span>
          {alerts.length > 1 && (
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
              style={{ color: tone }}
            />
          )}
        </button>

        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" style={{ color: tone }} />
        </button>
      </div>

      {/* Expanded list */}
      {open && alerts.length > 1 && (
        <ul className="space-y-1 border-t px-4 py-2.5" style={{ borderColor: border }}>
          {alerts.map((a, i) => {
            const Icon = sevIcon[a.severity];
            const c = sevColor[a.severity];
            return (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                <Icon className="h-4 w-4 shrink-0" style={{ color: c }} />
                <span style={{ color: c }}>{a.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

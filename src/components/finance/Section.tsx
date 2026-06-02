import { cn } from "@/lib/utils";

/**
 * Staggered page-load reveal wrapper. Children fade + rise into place;
 * pass an index to stagger sequential blocks.
 */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("reveal", className)}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {children}
    </div>
  );
}

/** Editorial section header: serif title + optional action on the right. */
export function SectionHeader({
  title,
  caption,
  action,
  className,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      </div>
      {action}
    </div>
  );
}

/** A soft surface card panel wrapping its children with padding. */
export function Panel({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cn("card-soft", padded && "p-5", className)}>{children}</div>
  );
}

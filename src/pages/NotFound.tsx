import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="reveal card-soft relative z-10 max-w-md p-10 text-center shadow-[var(--shadow-lift)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Family CFO</p>
        <h1 className="mt-2 font-display text-6xl font-semibold tracking-tight text-foreground">404</h1>
        <p className="mt-3 text-lg text-muted-foreground">This page isn't on the books.</p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          Return to Dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LAST_RUN_KEY = "familycfo.recurringAutoPost.lastRun";

/**
 * Posts any due recurring income/expenses by invoking the `process-recurring`
 * edge function. There is no server cron, so we trigger it from the app — once
 * per calendar day, by an admin session (the function runs with service role
 * internally; the JWT just gates who can call it).
 */
export function useRecurringAutoPost() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || role !== "admin") return;

    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(LAST_RUN_KEY) === today) return;

    // Optimistically mark today so we don't double-fire across remounts.
    localStorage.setItem(LAST_RUN_KEY, today);

    supabase.functions
      .invoke("process-recurring")
      .then(({ data, error }) => {
        if (error) {
          localStorage.removeItem(LAST_RUN_KEY); // allow retry on next load
          return;
        }
        if (data?.generated > 0) {
          queryClient.invalidateQueries({ queryKey: ["income"] });
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
        }
      })
      .catch(() => localStorage.removeItem(LAST_RUN_KEY));
  }, [user, role, queryClient]);
}

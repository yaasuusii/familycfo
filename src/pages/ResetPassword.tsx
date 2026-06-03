import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet, Eye, EyeOff, Check, X } from "lucide-react";

function strengthScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function strengthLabel(score: number) {
  if (score <= 1) return { label: "Weak", color: "bg-destructive" };
  if (score === 2) return { label: "Fair", color: "bg-warning" };
  if (score === 3) return { label: "Good", color: "bg-[hsl(var(--info))]" };
  return { label: "Strong", color: "bg-success" };
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const score = useMemo(() => strengthScore(password), [password]);
  const { label, color } = strengthLabel(score);
  const mismatch = confirm.length > 0 && password !== confirm;
  const match = confirm.length > 0 && password === confirm;

  const req = [
    { text: "At least 8 characters", ok: password.length >= 8 },
    { text: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { text: "One number", ok: /[0-9]/.test(password) },
    { text: "One special character", ok: /[^A-Za-z0-9]/.test(password) },
  ];

  const canSubmit = password.length >= 8 && score >= 2 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated — please sign in");
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[hsl(var(--info))]/12 blur-3xl" />

      <Card className="reveal card-soft relative w-full max-w-md border-0 shadow-[var(--shadow-lift)]">
        <CardHeader className="text-center">
          <div className="hero-brand mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-[var(--shadow-lift)]">
            <Wallet className="h-7 w-7 text-white" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Family CFO</p>
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">Set a new password</CardTitle>
          <CardDescription>Choose a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${color}`}
                          style={{ width: `${(score / 4) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    </div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {req.map((r) => (
                        <li key={r.text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {r.ok ? <Check className="h-3 w-3 text-success" /> : <X className="h-3 w-3 text-destructive opacity-60" />}
                          <span className={r.ok ? "text-foreground" : ""}>{r.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className={`pr-10 ${mismatch ? "border-destructive ring-1 ring-destructive" : match ? "border-success ring-1 ring-success" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mismatch && <p className="text-xs text-destructive">Passwords don't match</p>}
                {match && <p className="text-xs text-success">Passwords match</p>}
              </div>

              <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                Back to sign in
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

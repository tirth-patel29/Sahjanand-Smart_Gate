import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, Lock } from "lucide-react";
import { markPasswordChanged } from "@/lib/auth-utils";

interface PasswordChangeDialogProps {
  open: boolean;
  onComplete: () => void;
}

/**
 * Password change dialog - Shown on first login
 * Resident must change their temporary password before accessing the portal
 */
export function PasswordChangeDialog({ open, onComplete }: PasswordChangeDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!currentPassword) {
      setError("Current password is required");
      return;
    }
    if (!newPassword) {
      setError("New password is required");
      return;
    }
    if (!confirmPassword) {
      setError("Password confirmation is required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);

    try {
      // First, verify current password by re-authenticating
      const { data: userEmail } = await supabase.auth.getUser();
      if (!userEmail.user?.email) {
        throw new Error("Could not get user email");
      }

      // Try to sign in with current credentials to verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail.user.email,
        password: currentPassword,
      });

      if (signInError) {
        setError("Current password is incorrect");
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Mark password as changed in profiles table
      await markPasswordChanged();

      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onComplete();
    } catch (e) {
      const message = (e as Error).message || "Failed to change password";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent className="glass rounded-3xl sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl gradient-hero shadow-glass">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Change Your Password</DialogTitle>
              <DialogDescription className="mt-1">
                This is your first login. Please set a secure password.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password (Temporary)</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Enter your temporary password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              required
            />
            <p className="text-xs text-muted-foreground">
              Use the temporary password provided to you (format: sahjanand@[house-number])
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Create a strong password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              required
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters, use numbers and special characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading}
              className="w-full gradient-hero text-white border-0 shadow-glass"
            >
              {loading ? "Changing Password..." : "Change Password"}
            </Button>
          </DialogFooter>
        </form>

        <div className="rounded-2xl bg-blue-50 dark:bg-blue-950 p-3 text-xs text-blue-900 dark:text-blue-100">
          <strong>Why this is required:</strong> For your security, we require you to change your temporary password on first login.
        </div>
      </DialogContent>
    </Dialog>
  );
}

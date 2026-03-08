"use client";

import { useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const userId = searchParams.get("userId") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, userId, newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/auth/signin"), 2000);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4 text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20
                        flex items-center justify-center mx-auto">
          <CheckCircle size={22} className="text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Password reset</h2>
          <p className="text-sm text-white/40 mt-1">Redirecting to sign in...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Reset password
        </h2>
        <p className="text-sm text-white/40">
          Choose a strong new password.
        </p>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs font-medium">New password</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 bg-white/[0.04] border-white/[0.08] text-white
                         placeholder:text-white/20 focus:border-white/30
                         focus:ring-0 focus:bg-white/[0.06] transition-all pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs font-medium">Confirm password</Label>
          <Input
            type="password"
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-10 bg-white/[0.04] border-white/[0.08] text-white
                       placeholder:text-white/20 focus:border-white/30
                       focus:ring-0 focus:bg-white/[0.06] transition-all"
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !password || !confirm}
          className="w-full h-10 bg-white text-black font-medium hover:bg-white/90 transition-all disabled:opacity-30"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12h0a12 12 0 00-12 12h4z" />
              </svg>
              Resetting...
            </span>
          ) : "Reset password"}
        </Button>
      </div>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
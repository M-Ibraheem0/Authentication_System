"use client";

import { useState, useEffect } from "react";
import { User, Mail, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const router = useRouter()
  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((d) => setEmail(d.user?.email ?? ""));
  }, []);
  const handleDeleteAccount = async () => {
    setDeleteError("")
    setDeleteLoading(true)
    try {
      const res = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error)
        return
      }
      router.push("/auth/signin")
    } finally {
      setDeleteLoading(false)
    }
  }
  return (
    <div className="space-y-8 max-w-2xl">

      {/* header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          Settings
        </h1>
        <p className="text-white/40 text-sm">
          Manage your account information
        </p>
      </div>

      {/* account info card */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">

        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <User size={15} className="text-white/40" />
            <h2 className="text-sm font-medium text-white/80">
              Account Information
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-5">

          {/* avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/[0.06]
                            border border-white/[0.08]
                            flex items-center justify-center flex-shrink-0">
              <span className="text-white/50 text-xl font-medium">
                {email.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium">
                Profile picture
              </p>
              <p className="text-white/30 text-xs mt-0.5">
                Avatar based on your initials
              </p>
            </div>
          </div>

          {/* email */}
          <div className="space-y-1.5">
            <Label className="text-white/50 text-xs font-medium">
              Email address
            </Label>
            <div className="relative">
              <Mail
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20"
              />
              <Input
                value={email}
                disabled
                className="pl-9 h-10 bg-white/[0.03] border-white/[0.06]
                           text-white/50 cursor-not-allowed"
              />
            </div>
            <p className="text-white/25 text-xs">
              Email cannot be changed at this time
            </p>
          </div>

        </div>

      </div>
    <div className="rounded-xl border border-red-500/[0.15] bg-red-500/[0.03] overflow-hidden">
      <div className="px-6 py-4 border-b border-red-500/[0.10]">
        <h2 className="text-sm font-medium text-red-400/80">
          Danger Zone
        </h2>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <p className="text-white/60 text-sm font-medium">Delete account</p>
          <p className="text-white/30 text-xs mt-0.5 leading-relaxed">
            Permanently delete your account and all associated data.
            This action cannot be undone.
          </p>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded-lg border border-red-500/20
                      bg-red-500/[0.06] text-red-400/80
                      hover:bg-red-500/[0.12] hover:text-red-400
                      text-sm transition-all duration-150"
          >
            Delete account
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {deleteError && (
              <div className="px-3.5 py-2.5 rounded-lg bg-red-500/10
                              border border-red-500/20 text-red-400 text-sm">
                {deleteError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-white/50 text-xs">
                Enter your password to confirm
              </Label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your password"
                className="h-10 bg-white/[0.03] border-red-500/20
                          text-white placeholder:text-white/20
                          focus:border-red-500/40 focus:ring-0"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
                className="px-4 py-2 rounded-lg bg-red-500/80
                          hover:bg-red-500 text-white text-sm
                          transition-all duration-150
                          disabled:opacity-40"
              >
                {deleteLoading ? "Deleting..." : "Confirm delete"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletePassword("")
                  setDeleteError("")
                }}
                className="px-4 py-2 rounded-lg border border-white/[0.08]
                          text-white/40 hover:text-white/70
                          text-sm transition-all duration-150"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
    </div>
  );
}
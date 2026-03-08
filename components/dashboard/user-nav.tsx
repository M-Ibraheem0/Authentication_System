"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";

interface UserNavProps {
  user: {
    id: string;
    email: string;
    mfaEnabled: boolean;
  };
}

export function UserNav({ user }: UserNavProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignout = async () => {
    setLoading(true);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/auth/signin");
  };

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg
                   hover:bg-white/[0.06] transition-all duration-150"
      >
        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10
                        flex items-center justify-center">
          <span className="text-white/70 text-xs font-medium">{initials}</span>
        </div>
        <span className="text-white/60 text-sm hidden sm:block">
          {user.email}
        </span>
        <ChevronDown
          size={14}
          className={`text-white/30 transition-transform duration-150
                      ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />

          {/* dropdown */}
          <div className="absolute right-0 top-full mt-2 w-56 z-20
                          rounded-xl border border-white/[0.08]
                          bg-[#111] shadow-2xl overflow-hidden">

            {/* user info */}
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-white/80 text-sm font-medium truncate">
                {user.email}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full
                                ${user.mfaEnabled
                                  ? "bg-green-400"
                                  : "bg-white/20"
                                }`}
                />
                <p className="text-white/30 text-xs">
                  {user.mfaEnabled ? "MFA enabled" : "MFA disabled"}
                </p>
              </div>
            </div>

            {/* signout */}
            <div className="p-1.5">
              <button
                onClick={handleSignout}
                disabled={loading}
                className="w-full flex items-center gap-2.5 px-3 py-2
                           rounded-lg text-sm text-white/50
                           hover:bg-white/[0.06] hover:text-white/80
                           transition-all duration-150 disabled:opacity-50"
              >
                <LogOut size={14} />
                {loading ? "Signing out..." : "Sign out"}
              </button>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
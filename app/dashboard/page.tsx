import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Shield, Key, Monitor, User, ChevronRight, CheckCircle, AlertCircle
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/signin");

  const cards = [
    {
      href: "/dashboard/settings",
      icon: User,
      label: "Account",
      description: "Manage your email and profile",
      status: null,
    },
    {
      href: "/dashboard/security",
      icon: Shield,
      label: "Security",
      description: "Password and two-factor auth",
      status: user.mfaEnabled ? "MFA enabled" : "MFA disabled",
      statusOk: user.mfaEnabled,
    },
    {
      href: "/dashboard/sessions",
      icon: Monitor,
      label: "Sessions",
      description: "Manage active devices",
      status: null,
    },
  ];

  return (
    <div className="space-y-8">

      {/* header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          Overview
        </h1>
        <p className="text-white/40 text-sm">
          Welcome back, {user.email}
        </p>
      </div>

      {/* MFA warning */}
      {!user.mfaEnabled && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl
                        bg-yellow-500/[0.06] border border-yellow-500/[0.15]">
          <AlertCircle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-yellow-400 text-sm font-medium">
              Two-factor authentication is disabled
            </p>
            <p className="text-yellow-400/60 text-xs mt-0.5">
              Enable MFA to add an extra layer of security to your account.
            </p>
          </div>
          <Link
            href="/dashboard/security"
            className="text-yellow-400/70 hover:text-yellow-400
                       text-xs underline underline-offset-4
                       transition-colors flex-shrink-0"
          >
            Enable now
          </Link>
        </div>
      )}

      {/* cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-4 p-5 rounded-xl
                         border border-white/[0.06] bg-white/[0.02]
                         hover:bg-white/[0.04] hover:border-white/[0.10]
                         transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06]
                                border border-white/[0.08]
                                flex items-center justify-center">
                  <Icon size={15} className="text-white/50" />
                </div>
                <ChevronRight
                  size={14}
                  className="text-white/20 group-hover:text-white/40
                             transition-colors"
                />
              </div>

              <div className="space-y-1">
                <p className="text-white/80 text-sm font-medium">
                  {card.label}
                </p>
                <p className="text-white/30 text-xs">
                  {card.description}
                </p>
              </div>

              {card.status && (
                <div className="flex items-center gap-1.5">
                  {card.statusOk
                    ? <CheckCircle size={12} className="text-green-400" />
                    : <AlertCircle size={12} className="text-white/30" />
                  }
                  <span className={`text-xs ${card.statusOk
                    ? "text-green-400"
                    : "text-white/30"
                  }`}>
                    {card.status}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

    </div>
  );
}
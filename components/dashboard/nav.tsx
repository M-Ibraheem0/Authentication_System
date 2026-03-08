"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/security", label: "Security" },
  { href: "/dashboard/sessions", label: "Sessions" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`
              px-3 py-1.5 rounded-md text-sm transition-all duration-150
              ${isActive
                ? "bg-white/[0.08] text-white font-medium"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }
            `}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard/nav";
import { UserNav } from "@/components/dashboard/user-nav";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/signin");

  return (
    <div className="min-h-screen bg-[#0a0a0a]">

      {/* top bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06]
                          bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* logo */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-white/10 border border-white/20
                              flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-sm bg-white" />
              </div>
              <span className="text-white font-semibold text-sm tracking-tight">
                Authentication 
              </span>
            </div>

            {/* nav links */}
            <DashboardNav />
          </div>

          {/* user menu */}
          <UserNav user={user} />

        </div>
      </header>

      {/* page content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {children}
      </main>

    </div>
  );
}
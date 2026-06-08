"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Briefcase,
  ExternalLink,
  ListChecks,
  Loader2,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { SparkLogo } from "@/components/spark/SparkBrand";
import { SparkAdminDialog } from "@/components/spark/SparkAdminDialog";

const NAV = [
  { href: "/spark/recruiter", label: "Jobs", icon: Briefcase, exact: true },
  { href: "/spark/recruiter/questions", label: "Questions", icon: ListChecks, exact: false },
];

function initials(email: string | null) {
  if (!email) return "R";
  const name = email.split("@")[0] || email;
  return name.slice(0, 2).toUpperCase();
}

export function SparkRecruiterNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const signOut = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/spark/auth/logout", { method: "POST" });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Unable to sign out.");
      }
      toast.success("Signed out.");
      router.replace("/spark/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--sn-line)] bg-white/90 backdrop-blur">
      <div className="sn-container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <SparkLogo href="/spark/recruiter" />
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--sn-ink)] text-white"
                      : "text-[var(--sn-ink)] hover:bg-black/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="hidden items-center gap-1 text-sm text-[var(--sn-muted)] hover:text-[var(--sn-ink)] sm:flex"
          >
            Public site
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sn-ink)] text-xs font-bold text-white"
              title={email || "Account"}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {initials(email)}
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-11 z-50 w-60 rounded-md border border-[var(--sn-line)] bg-white p-1 shadow-lg">
                  <div className="px-3 py-2 text-xs text-[var(--sn-muted)]">
                    Signed in as
                    <div className="mt-0.5 break-all font-medium text-[var(--sn-ink)]">
                      {email || "Recruiter"}
                    </div>
                  </div>
                  <div className="my-1 h-px bg-[var(--sn-line)]" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setAdminOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-[var(--sn-ink)] hover:bg-black/5"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    disabled={loading}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-[var(--sn-ink)] hover:bg-black/5 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <SparkAdminDialog open={adminOpen} onClose={() => setAdminOpen(false)} />
    </header>
  );
}

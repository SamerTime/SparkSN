"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { BriefcaseBusiness, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export default function Navbar() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="sticky top-0 z-30 w-full border-b border-[#ded7cc] bg-[#fdfaf4]/95 font-sans shadow-sm backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/jobs"
            className="flex items-center gap-3 select-none transition hover:opacity-90"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#176c5d] text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-normal text-[#15191e]">
                StaffingNation
              </span>
              <span className="block text-xs font-medium uppercase tracking-normal text-[#86633d]">
                Spark
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-[#4f5963] hover:bg-[#f0eadf] hover:text-[#15191e] sm:inline-flex"
            >
              <Link href="/jobs">Open jobs</Link>
            </Button>

            {session && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden text-[#4f5963] hover:bg-[#f0eadf] hover:text-[#15191e] sm:inline-flex"
              >
                <Link href="/companies">Recruiter workspace</Link>
              </Button>
            )}

            {session ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="hidden cursor-pointer items-center gap-1 text-[#4f5963] transition hover:bg-[#f0eadf] hover:text-[#15191e] sm:flex"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="cursor-pointer text-[#4f5963] transition hover:bg-[#f0eadf] hover:text-[#15191e] sm:hidden"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>

                <Link href="/profile" className="cursor-pointer" aria-label="Profile">
                  <Avatar className="h-9 w-9 border border-[#d8d1c6]">
                    <AvatarImage
                      src={user?.image || undefined}
                      alt={user?.firstName || "User"}
                    />
                    <AvatarFallback className="bg-[#edf5f1] text-[#176c5d]">
                      {user?.firstName?.[0]?.toUpperCase() ||
                        user?.email?.[0]?.toUpperCase() || (
                          <UserIcon className="h-5 w-5" />
                        )}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </div>
            ) : (
              <Button
                variant="default"
                asChild
                size="sm"
                className="cursor-pointer bg-[#20282d] text-white transition hover:bg-[#344047]"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

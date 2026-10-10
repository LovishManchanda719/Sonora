"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Mic,
  Sparkles,
  HeartHandshake,
  User as UserIcon,
  LogOut,
   ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, profilePhotoUrl, signOut } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/", icon: Activity },
    { label: "Screen Voice", href: "/screen", icon: Mic },
    { label: "Rehab Therapy", href: "/therapy", icon: Sparkles },
    { label: "Caregiver Hub", href: "/resources", icon: HeartHandshake },
    ...(isAdmin
      ? [{ label: "Admin Analytics", href: "/admin", icon: ShieldCheck }]
      : []),
  ];

  const isProfileActive =
    pathname.startsWith("/profile") || pathname.startsWith("/history");
  const avatarSrc = profilePhotoUrl || user?.photoURL || null;

  return (
    <header className="sticky top-4 z-50 w-full px-4 sm:px-8">
      <div className="mx-auto max-w-7xl flex items-center justify-between bg-[#14171A]/95 backdrop-blur-md text-white rounded-full px-5 py-3 shadow-soft-lg border border-white/10">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-clinical-cyan to-vitality flex items-center justify-center text-black font-extrabold shadow-glow-cyan transition-transform group-hover:scale-105">
            <Activity className="h-5 w-5 text-[#14171A]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-white">
              Sonora<span className="text-vitality">.ai</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
              DysarthriaNet-XC
            </span>
          </div>
        </Link>

        {/* Center Nav Pills */}
        <nav className="hidden md:flex items-center gap-1.5 bg-black/30 p-1.5 rounded-full border border-white/5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white text-black shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? "text-black" : "text-slate-400"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action / Profile Hub */}
        <div className="flex items-center gap-2">

          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-vitality/20 border border-vitality/40 text-vitality text-[10px] font-extrabold uppercase tracking-wider hover:bg-vitality/30 transition-colors"
                  title="Open Admin Analytics & Command Center"
                >
                  <ShieldCheck className="h-3 w-3" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                href="/profile"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                  isProfileActive
                    ? "bg-white text-black border-white shadow-sm"
                    : "bg-white/10 hover:bg-white/15 border-white/10 text-slate-200"
                }`}
              >
                {avatarSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={avatarSrc}
                    alt={user.displayName || "User"}
                    className="h-5 w-5 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isProfileActive
                        ? "bg-[#14171A] text-vitality"
                        : "bg-clinical-cyan/30 text-clinical-cyan"
                    }`}
                  >
                    {user.email ? user.email[0].toUpperCase() : "U"}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[110px] truncate">
                  {user.displayName || user.email?.split("@")[0]}
                </span>
              </Link>
              <button
                onClick={() => signOut()}
                title="Sign Out"
                className="h-8 w-8 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
                  isProfileActive
                    ? "bg-white text-black border-white shadow-sm"
                    : "bg-white/10 hover:bg-white/15 text-slate-200 border-white/10"
                }`}
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
              <Link
                href="/auth"
                className="flex items-center gap-1.5 bg-vitality hover:bg-vitality-hover text-[#14171A] px-4 py-2 rounded-full text-xs font-bold shadow-soft-sm hover:shadow-glow-vitality transition-all"
              >
                <span>Sign In</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

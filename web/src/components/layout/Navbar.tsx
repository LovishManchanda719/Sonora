"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Mic,
  AudioLines,
  HeartHandshake,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Smartphone,
  Info,
  Mail,
  LogIn,
  ChevronRight,
  House,
} from "lucide-react";
import { useAuth, formatUserIdentifier } from "@/lib/auth-context";

const APK_URL =
  "https://github.com/LovishManchanda719/Sonora/raw/main/android/sonora-android.apk";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, profilePhotoUrl, linkedIdentity, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock page scroll while the mobile menu sheet is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const isProfileActive =
    pathname.startsWith("/profile") || pathname.startsWith("/history");

  const navItems = [
    { label: "Dashboard", short: "Home", href: "/", icon: House, active: pathname === "/" },
    {
      label: "Screen Voice",
      short: "Screen",
      href: "/screen",
      icon: Mic,
      active: pathname.startsWith("/screen") || pathname.startsWith("/results"),
    },
    {
      label: "Rehab Therapy",
      short: "Therapy",
      href: "/therapy",
      icon: AudioLines,
      active: pathname.startsWith("/therapy"),
    },
    {
      label: "Caregiver Hub",
      short: "Care",
      href: "/resources",
      icon: HeartHandshake,
      active: pathname.startsWith("/resources"),
    },
  ];

  // Bottom tab bar on phones: the four main sections + Profile
  const tabItems = [
    ...navItems,
    { label: "Profile", short: "Profile", href: "/profile", icon: UserIcon, active: isProfileActive },
  ];

  const avatarSrc = profilePhotoUrl || user?.photoURL || null;
  const displayName = user
    ? user.displayName ||
      formatUserIdentifier(user.email, user.displayName, linkedIdentity) ||
      user.email?.split("@")[0] ||
      "Account"
    : "";
  const initial = (displayName.replace(/\+/g, "").trim()[0] || "U").toUpperCase();

  const Avatar = ({ size = "h-7 w-7" }: { size?: string }) =>
    avatarSrc ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={avatarSrc}
        alt=""
        referrerPolicy="no-referrer"
        className={`${size} rounded-full object-cover border border-white/20`}
      />
    ) : (
      <span
        className={`${size} rounded-full flex items-center justify-center text-[11px] font-bold bg-clinical-cyan/30 text-clinical-cyan`}
      >
        {initial}
      </span>
    );

  return (
    <>
      <header className="sticky top-2 sm:top-4 z-50 w-full px-3 sm:px-8">
        <div className="mx-auto max-w-7xl bg-[#14171A]/95 backdrop-blur-md text-white rounded-full px-3 sm:px-5 py-2 sm:py-3 shadow-soft-lg border border-white/10">
          <div className="flex items-center justify-between gap-2">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0" aria-label="Sonora home">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-tr from-clinical-cyan to-vitality flex items-center justify-center">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-[#14171A]" />
              </div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight">
                Sonora<span className="text-vitality">.ai</span>
              </span>
            </Link>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center gap-1.5 bg-black/30 p-1.5 rounded-full border border-white/5">
              {[...navItems, ...(isAdmin ? [{ label: "Admin", short: "Admin", href: "/admin", icon: ShieldCheck, active: pathname.startsWith("/admin") }] : [])].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      item.active
                        ? "bg-white text-black shadow-sm"
                        : "text-slate-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${item.active ? "text-black" : "text-slate-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className={`hidden md:flex items-center gap-2 pl-1 pr-3.5 py-1 rounded-full border text-xs font-semibold transition-all ${
                      isProfileActive
                        ? "bg-white text-black border-white"
                        : "bg-white/10 hover:bg-white/15 border-white/10 text-slate-200"
                    }`}
                  >
                    <Avatar />
                    <span className="max-w-[120px] truncate">{displayName}</span>
                  </Link>
                  <button
                    onClick={() => signOut()}
                    title="Sign out"
                    aria-label="Sign out"
                    className="hidden md:flex h-8 w-8 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 items-center justify-center text-slate-400 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                  <Link href="/profile" className="md:hidden" aria-label="Profile">
                    <Avatar size="h-8 w-8" />
                  </Link>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="flex items-center gap-1.5 bg-vitality hover:bg-vitality-hover text-[#14171A] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-extrabold transition-all"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign in</span>
                </Link>
              )}

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                className="md:hidden h-8 w-8 rounded-full flex items-center justify-center bg-white/10 border border-white/15 cursor-pointer"
              >
                {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu sheet: secondary links only, the main sections live in the bottom bar */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-3 right-3 top-16 bg-white rounded-3xl shadow-soft-lg border border-slate-100 p-2">
            {user && (
              <Link
                href="/profile"
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50"
              >
                <span className="bg-[#14171A] rounded-full p-0.5">
                  <Avatar size="h-9 w-9" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 truncate">{displayName}</span>
                  <span className="block text-xs text-slate-500">Profile and history</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            )}
            {[
              ...(isAdmin ? [{ href: "/admin", label: "Admin analytics", icon: ShieldCheck }] : []),
              { href: "/about", label: "About Sonora", icon: Info },
              { href: "/contact", label: "Contact", icon: Mail },
            ].map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 text-sm font-semibold text-slate-800"
                >
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="flex-1">{l.label}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              );
            })}
            <a
              href={APK_URL}
              download="Sonora-Android.apk"
              className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 text-sm font-semibold text-slate-800"
            >
              <Smartphone className="h-4 w-4 text-slate-500" />
              <span className="flex-1">Download Android app</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </a>
            {user && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-red-50 text-sm font-semibold text-red-600 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 pointer-events-none"
      >
        <div className="pointer-events-auto mx-auto max-w-md bg-[#14171A] rounded-full p-1.5 flex items-center justify-between shadow-soft-lg border border-white/10">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={item.active ? "page" : undefined}
                className={`flex items-center justify-center gap-1.5 h-11 rounded-full text-xs font-bold transition-all ${
                  item.active
                    ? "bg-vitality text-[#14171A] px-4"
                    : "text-slate-400 hover:text-white px-3"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {item.active && <span>{item.short}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

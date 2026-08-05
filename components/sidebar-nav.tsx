"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Bot,
  Receipt,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { AgentStatusPill } from "@/components/agent-status-pill";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/agent", label: "Agent WhatsApp", icon: Bot },
  { href: "/facturation", label: "Facturation", icon: Receipt },
  { href: "/reglages", label: "Réglages", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex h-16 shrink-0 flex-col justify-center border-b border-sidebar-border px-6"
      >
        <span className="font-display text-xl font-semibold italic tracking-tight text-primary">
          L&apos;art de vivre
        </span>
        <span className="text-[10px] uppercase tracking-[0.22em] text-champagne">
          Conciergerie privée
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active && "text-champagne")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <AgentStatusPill />
      </div>
    </div>
  );
}

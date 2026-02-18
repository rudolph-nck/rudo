"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const noPadding = pathname.startsWith("/dashboard/messages");

  return <DashboardShell noPadding={noPadding}>{children}</DashboardShell>;
}

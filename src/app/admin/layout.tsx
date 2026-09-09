import type { ReactNode } from "react";

import { requireCommissioner } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCommissioner();
  return children;
}

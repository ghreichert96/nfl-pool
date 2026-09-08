import Link from "next/link";
import { PageHeading, PageShell } from "@/components/page-shell";
import { getPoolContext } from "@/lib/pool-context";
export default async function MenuPage() {
  const { entry, isCommissioner } = await getPoolContext();
  const links = [
    ["Profile", "/account"],
    ["Rules", "/rules"],
    ["Settings", "/settings"],
    ["History", "/history"],
    ["About", "/about"],
    ...(isCommissioner ? [["Commissioner", "/admin"]] : []),
  ];
  return (
    <PageShell entryCode={entry?.entry_code} isCommissioner={isCommissioner}>
      <PageHeading eyebrow="HPPP" title="Menu" />
      <nav className="game-card overflow-hidden rounded-xl border">
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-14 items-center justify-between border-b border-slate-800 px-4 font-black last:border-0"
          >
            {label}
            <span aria-hidden="true" className="text-slate-500">
              ›
            </span>
          </Link>
        ))}
      </nav>
    </PageShell>
  );
}

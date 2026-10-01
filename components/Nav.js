"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ admin }) {
  const p = usePathname();
  const items = [["/heute", "Heute"], ["/entwicklung", "Entwicklung"], ["/eingaben", "Eingaben"], ["/bilder", "Bilder & Dokumente"], ["/quellen", "Quellen"]];
  if (admin) items.push(["/admin", "Admin"]);
  return (
    <nav className="tabs" aria-label="Bereiche">
      {items.map(([href, label]) => <Link key={href} href={href} className={p.startsWith(href) ? "on" : ""}>{label}</Link>)}
    </nav>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ admin, demo }) {
  const p = usePathname();
  const items = demo
    ? [["/demo", "Heute"], ["/demo/ziele", "Ziele & Plan"], ["/demo/entwicklung", "Entwicklung"], ["/demo/eingaben", "Eingaben"], ["/demo/bilder", "Körper & Bilder"]]
    : [["/heute", "Heute"], ["/ziele", "Ziele & Plan"], ["/entwicklung", "Entwicklung"], ["/eingaben", "Eingaben"], ["/bilder", "Bilder & Dokumente"], ["/quellen", "Quellen"]];
  if (admin && !demo) items.push(["/admin", "Admin"]);
  return (
    <nav className="tabs" aria-label="Bereiche">
      {items.map(([href, label]) => <Link key={href} href={href} className={(href === "/demo" ? p === "/demo" : p.startsWith(href)) ? "on" : ""}>{label}</Link>)}
    </nav>
  );
}

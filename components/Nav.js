"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ admin, demo }) {
  const p = usePathname();
  const items = demo
    ? [["/demo", "Übersicht"], ["/demo/ziele", "Ziele & Plan"], ["/demo/entwicklung", "Entwicklung"], ["/demo/bilder", "Körper"], ["/demo/tests", "Tests"], ["/demo/tagebuch", "Tagebuch"]]
    : [["/heute", "Übersicht"], ["/ziele", "Ziele & Plan"], ["/entwicklung", "Entwicklung"], ["/bilder", "Körper"], ["/tests", "Tests"], ["/tagebuch", "Tagebuch"], ["/quellen", "Quellen"]];
  if (admin && !demo) items.push(["/admin", "Admin"]);
  return (
    <nav className="tabs" aria-label="Bereiche">
      {items.map(([href, label]) => <Link key={href} href={href} className={(href === "/demo" ? p === "/demo" : p.startsWith(href)) ? "on" : ""}>{label}</Link>)}
    </nav>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Auf jeder Unterseite: zurück zur Übersicht.
export default function BackLink({ demo }) {
  const p = usePathname();
  const home = demo ? "/demo" : "/heute";
  if (p === home) return null;
  return <Link href={home} className="back">← Übersicht</Link>;
}

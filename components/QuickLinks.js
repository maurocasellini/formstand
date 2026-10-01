import Link from "next/link";

// Schnellzugriff auf der Übersicht: Wohin für welche Aufgabe.
const LINKS = [
  ["/ziele?d=today#plan", "Training anpassen", "Keine Zeit, mit Buddy, fester Termin"],
  ["/tagebuch#training", "Training nachtragen", "Einheit ohne Uhr erfassen"],
  ["/tests#test", "Test eintragen", "Kraft, Lauf, Fitness, FTP"],
  ["/ziele#plan", "Wochenplan", "Was diese Woche ansteht"],
  ["/ziele#meineziele", "Meine Ziele", "Was bis wann – auf Kurs?"],
  ["/ziele#wettkampf", "Wettkämpfe", "Rennen, Schwächen, Zeitbudget"],
  ["/bilder#hinzufuegen", "Foto / InBody hochladen", "Formstand erkennt selbst, was es ist"],
  ["/bilder#verlauf", "Körperentwicklung", "InBody, Fotos, Vorher/Nachher"],
  ["/bilder#messwerte", "Gewicht & Messwerte", "Gewicht, Körperfett, Grösse"],
  ["/entwicklung", "Entwicklung", "Was sich verändert hat"],
];

export default function QuickLinks({ base = "", demo = false }) {
  const items = LINKS.filter(([href]) => !(demo && href === "/quellen"));
  return (
    <nav className="quick" aria-label="Schnellzugriff">
      {items.map(([href, t, d]) => (
        <Link key={href} href={`${base}${href}`} className="quick-i"><b>{t}</b><span>{d}</span></Link>
      ))}
    </nav>
  );
}

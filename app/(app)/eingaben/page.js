import { redirect } from "next/navigation";

// Alte Adresse: Eingaben heisst jetzt Tagebuch (Tests haben eine eigene Seite)
export default function Eingaben() { redirect("/tagebuch"); }

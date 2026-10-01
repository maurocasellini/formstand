import { Sora, Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata = {
  title: "Formstand", description: "Trainings-Cockpit: Recovery, Workouts, Ernährung und Körper aus allen Quellen.",
  appleWebApp: { capable: true, title: "Formstand", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F7FB" }, { media: "(prefers-color-scheme: dark)", color: "#0B1020" }] };

// Gewählte Darstellung vor dem ersten Zeichnen setzen (kein Aufblitzen)
const THEME_JS = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="de-CH" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_JS }} /></head>
      <body>{children}</body>
    </html>
  );
}

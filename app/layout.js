import { Sora, Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata = { title: "Formstand", description: "Trainings-Cockpit: Recovery, Workouts, Ernährung und Körper aus allen Quellen." };
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F5F7FB" };

export default function RootLayout({ children }) {
  return (
    <html lang="de-CH" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

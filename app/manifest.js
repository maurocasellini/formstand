export default function manifest() {
  return {
    name: "Formstand", short_name: "Formstand", description: "Tagesform, Training und Erholung aus allen Quellen.",
    start_url: "/heute", display: "standalone", background_color: "#F5F7FB", theme_color: "#F5F7FB", lang: "de-CH",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }],
  };
}

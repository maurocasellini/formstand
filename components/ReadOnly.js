"use client";
import { createContext } from "react";

// In der öffentlichen Demo sind alle Formulare gesperrt (nur ansehen).
export const ReadOnlyContext = createContext(false);
export default function ReadOnly({ children }) {
  return <ReadOnlyContext.Provider value={true}>{children}</ReadOnlyContext.Provider>;
}

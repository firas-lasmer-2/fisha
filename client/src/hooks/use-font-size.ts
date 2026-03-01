import { useState, useEffect } from "react";

export type FontSize = "sm" | "md" | "lg";

const STORAGE_KEY = "shifa-font-size";

function applyFontSize(size: FontSize) {
  const root = document.documentElement;
  if (size === "md") {
    root.removeAttribute("data-font-size");
  } else {
    root.setAttribute("data-font-size", size);
  }
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "md";
    return (localStorage.getItem(STORAGE_KEY) as FontSize) || "md";
  });

  // Apply on mount
  useEffect(() => {
    applyFontSize(fontSize);
  }, []);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    applyFontSize(size);
    localStorage.setItem(STORAGE_KEY, size);
  };

  return { fontSize, setFontSize };
}

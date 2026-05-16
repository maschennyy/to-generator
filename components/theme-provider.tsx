"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  // Baca preferensi dari localStorage saat pertama kali mount
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored)
    }
  }, [])

  // Terapkan class dark ke <html> setiap kali theme berubah
  useEffect(() => {
    const root = document.documentElement

    function applyTheme(t: Theme) {
      if (t === "dark") {
        root.classList.add("dark")
        setResolvedTheme("dark")
      } else if (t === "light") {
        root.classList.remove("dark")
        setResolvedTheme("light")
      } else {
        // System: ikuti preferensi OS
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        root.classList.toggle("dark", prefersDark)
        setResolvedTheme(prefersDark ? "dark" : "light")
      }
    }

    applyTheme(theme)

    // Dengarkan perubahan sistem jika mode "system"
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches)
        setResolvedTheme(e.matches ? "dark" : "light")
      }
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme)
    localStorage.setItem("theme", newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

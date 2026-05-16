"use client"

import { Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  function handleToggle() {
    if (theme === "light") setTheme("dark")
    else if (theme === "dark") setTheme("system")
    else setTheme("light")
  }

  const label =
    theme === "dark" ? "Mode Gelap" : theme === "system" ? "Mode Sistem" : "Mode Terang"

  return (
    <button
      onClick={handleToggle}
      title={`Tema saat ini: ${label}. Klik untuk berganti.`}
      className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
      aria-label={label}
    >
      {/* Sun: hanya terlihat saat resolvedTheme = light & bukan sistem */}
      <Sun
        className={`h-4 w-4 transition-all duration-300 absolute 
          ${resolvedTheme === "light" && theme !== "system" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"}`}
      />
      {/* Moon: hanya terlihat saat resolvedTheme = dark & bukan sistem */}
      <Moon
        className={`h-4 w-4 transition-all duration-300 absolute 
          ${resolvedTheme === "dark" && theme !== "system" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"}`}
      />
      {/* Monitor: hanya terlihat saat theme = system */}
      <Monitor
        className={`h-4 w-4 transition-all duration-300 absolute 
          ${theme === "system" ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
      />
    </button>
  )
}
import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: "class" | "data-theme" | "data-mode"
  defaultTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Use React.useMemo to prevent unnecessary re-renders during hydration
  // This reduces TBT by avoiding theme detection work during initial render
  return React.useMemo(
    () => <NextThemesProvider {...props}>{children}</NextThemesProvider>,
    [children, props.attribute, props.defaultTheme, props.enableSystem, props.disableTransitionOnChange]
  );
}

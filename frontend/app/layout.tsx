// app/layout.tsx

'use client'

import type { Metadata } from 'next'
import { Inter, Space_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Load fonts
const _inter = Inter({ subsets: ["latin"] });
const _spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"] });

// ⭐ Component that highlights active navigation item
/**
 * Navigation link that applies active-route styling when the current pathname
 * matches `href`.
 *
 * @param props.href  - The target URL path for the link.
 * @param props.label - The visible link text.
 * @returns An anchor element with conditional active styling.
 */
function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={`hover:underline transition ${
        isActive ? "text-orange-400 font-semibold underline" : "text-foreground"
      }`}
    >
      {label}
    </Link>
  )
}

/**
 * Root layout component applied to every page in the application.
 *
 * Wraps page content with a sticky header (including the `NavLink` navigation
 * bar), a footer, and the Vercel Analytics script. Enforces the dark colour
 * scheme via the `dark` class on `<html>`.
 *
 * @param props.children - The active page content rendered by Next.js.
 * @returns The full-page HTML shell as a JSX element.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-background text-foreground">

          {/* Header */}
          <header className="border-b border-border bg-card sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-6">
              <div className="flex justify-between items-center">

                {/* LEFT — Title */}
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🔥</div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Wildfire Vision
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Advanced forecasting using Prophet time series modeling
                    </p>
                  </div>
                </div>

                {/* RIGHT — Navigation */}
                <nav className="flex gap-6 text-sm">
                  <NavLink href="/" label="Home" />
                  {/* <NavLink href="/historical" label="Historical" /> */}
                  <NavLink href="/predictions" label="Predictions" />
                  {/* <NavLink href="/map" label="Map" /> */}
                </nav>
              </div>
            </div>
          </header>

          {/* Main Page Content */}
          {children}

          {/* Footer */}
          <footer className="border-t border-border bg-card mt-16">
            <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-muted-foreground">
              <p>
                Wildfire Vision • Powered by Prophet Time Series Modeling
              </p>
            </div>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  )
}

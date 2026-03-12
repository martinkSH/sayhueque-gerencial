import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Say Hueque · Gerencial',
  description: 'Dashboard de gestión Say Hueque',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}

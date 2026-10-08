import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'EcoIntelligence | Environmental Investigation & Action Platform',
  description: 'Evidence-first environmental investigation, change detection, and decision-support platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Bebas_Neue, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});
const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
});
const jbm = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbm',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Receptify — AI Voice Receptionist for Indian Businesses',
  description:
    'Upload your customer list, generate a script, and let Receptify’s AI voice agent handle the calls — with every outcome tracked in real time. Built for Indian SMEs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${bebas.variable} ${jbm.variable}`}>
      <body className="font-sans antialiased bg-white">
        {children}
        <Toaster
          richColors
          position="top-right"
          toastOptions={{ classNames: { toast: 'rounded-xl' } }}
        />
      </body>
    </html>
  );
}

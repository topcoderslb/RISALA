import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';
import InstallPWA from '@/components/InstallPWA';

export const metadata: Metadata = {
  title: 'المنطقة الثانية - جمعية الرسالة للإسعاف الصحي',
  description: 'منصة إدارة المنطقة الثانية - جمعية الرسالة للإسعاف الصحي',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#065f46',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-arabic antialiased">
        <AuthProvider>
          {children}
          <InstallPWA />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                fontFamily: 'Tajawal, sans-serif',
                direction: 'rtl',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}

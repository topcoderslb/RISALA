'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile) {
        switch (profile.role) {
          case 'superadmin':
            router.push('/admin');
            break;
          case 'center_leader':
            router.push('/center');
            break;
          case 'trainer':
            router.push('/trainer');
            break;
          default:
            router.push('/login');
        }
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto" />
        <p className="mt-4 text-slate-600">جاري التحميل...</p>
      </div>
    </div>
  );
}

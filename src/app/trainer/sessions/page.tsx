'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TrainerSessionsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/trainer/programs'); }, [router]);
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
    </div>
  );
}

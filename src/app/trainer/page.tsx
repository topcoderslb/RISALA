'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import StatCard from '@/components/StatCard';
import { GraduationCap, FolderOpen, FileText } from 'lucide-react';
import Link from 'next/link';

export default function TrainerDashboard() {
  const { profile } = useAuth();
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    async function fetchStats() {
      try {
        const [filesSnap, sessionsSnap] = await Promise.all([
          getDocs(query(collection(db, 'trainingFiles'), where('trainerId', '==', profile!.uid))),
          getDocs(query(collection(db, 'trainingSessions'), where('trainerId', '==', profile!.uid))),
        ]);
        setTotalFiles(filesSnap.size);
        setTotalSessions(sessionsSnap.size);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetchStats();
  }, [profile]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">لوحة تحكم المدرب</h1>
        <p className="text-slate-500 mt-1">مرحباً، {profile?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="الملفات التدريبية" value={totalFiles} icon={<FolderOpen size={24} />} color="purple" />
        <StatCard title="إجمالي الجلسات" value={totalSessions} icon={<GraduationCap size={24} />} color="blue" />
        <StatCard title="التقارير" value={totalSessions} icon={<FileText size={24} />} color="green" />
      </div>

      <Link href="/trainer/programs">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center hover:shadow-md transition-shadow cursor-pointer">
          <FolderOpen size={48} className="text-primary-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">الملفات التدريبية</h2>
          <p className="text-slate-500 text-sm">أنشئ ملفات تدريبية وأضف جلسات بداخل كل ملف</p>
        </div>
      </Link>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { useDailyReminder } from '@/lib/notifications';
import StatCard from '@/components/StatCard';
import { Ambulance, Users, Calendar, Download, Smartphone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function CenterDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ operations: 0, medics: 0, schedules: 0, emsOps: 0, rescueOps: 0 });
  const [centerImage, setCenterImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useDailyReminder(profile?.role === 'center_leader');

  useEffect(() => {
    if (!profile?.centerId) return;

    async function fetchStats() {
      try {
        const cid = profile!.centerId!;
        const [opsSnap, medicsSnap, schedulesSnap, centerDoc] = await Promise.all([
          cachedGetDocs(query(collection(db, 'operations'), where('centerId', '==', cid)), `operations:${cid}`),
          cachedGetDocs(query(collection(db, 'medics'), where('centerId', '==', cid)), `medics:${cid}`),
          cachedGetDocs(query(collection(db, 'schedules'), where('centerId', '==', cid)), `schedules:${cid}`),
          getDoc(doc(db, 'centers', cid)),
        ]);
        if (centerDoc.exists()) setCenterImage(centerDoc.data().image || null);

        const ops = opsSnap.docs.map((d) => d.data());
        setStats({
          operations: ops.length,
          medics: medicsSnap.size,
          schedules: schedulesSnap.size,
          emsOps: ops.filter((o) => o.type === 'EMS').length,
          rescueOps: ops.filter((o) => o.type === 'RESCUE').length,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [profile]);

  const pieData = [
    { name: 'إسعاف', value: stats.emsOps, color: '#3b82f6' },
    { name: 'إنقاذ', value: stats.rescueOps, color: '#f59e0b' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Center Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl h-44 shadow-lg">
        {centerImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${centerImage})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-l from-primary-900 to-primary-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-l from-slate-900/80 via-slate-900/50 to-transparent" />
        <div className="relative h-full flex flex-col justify-end p-6">
          <p className="text-emerald-300 text-sm font-medium mb-1">قائد المركز</p>
          <h1 className="text-2xl font-bold text-white">لوحة تحكم المركز</h1>
          <p className="text-white/70 mt-1">مرحباً، {profile?.name} — {profile?.centerName}</p>
        </div>
      </div>

      {/* Install App Card */}
      {!isStandalone && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
          <div className="p-3 bg-primary-100 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
            <Smartphone size={28} className="text-primary-700" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">تثبيت التطبيق</h3>
          <p className="text-sm text-slate-500 mb-4">اضغط على الزر لتنزيل التطبيق على هاتفك والوصول إليه بسهولة</p>
          {installPrompt ? (
            <button
              onClick={async () => { installPrompt.prompt(); const r = await installPrompt.userChoice; if (r.outcome === 'accepted') setInstallPrompt(null); }}
              className="inline-flex items-center gap-2 bg-gradient-to-l from-primary-700 to-primary-600 text-white rounded-xl py-3 px-8 font-bold shadow-lg hover:from-primary-800 hover:to-primary-700 transition-all"
            >
              <Download size={20} />
              تنزيل التطبيق
            </button>
          ) : (
            <p className="text-xs text-slate-400">افتح الموقع من المتصفح للتنزيل أو استخدم خيار &quot;إضافة إلى الشاشة الرئيسية&quot;</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="الحالات" value={stats.operations} icon={<Ambulance size={24} />} color="blue" />
        <StatCard title="المسعفين" value={stats.medics} icon={<Users size={24} />} color="green" />
        <StatCard title="الجداول" value={stats.schedules} icon={<Calendar size={24} />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">الحالات حسب النوع</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">ملخص</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <span className="text-sm text-slate-600">إسعاف</span>
              <span className="font-bold text-blue-600">{stats.emsOps}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
              <span className="text-sm text-slate-600">إنقاذ</span>
              <span className="font-bold text-orange-600">{stats.rescueOps}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <span className="text-sm text-slate-600">إجمالي الحالات</span>
              <span className="font-bold text-green-600">{stats.operations}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

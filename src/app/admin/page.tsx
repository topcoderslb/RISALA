'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import StatCard from '@/components/StatCard';
import { Building2, Ambulance, Users, GraduationCap, Activity, TrendingUp, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    centers: 0,
    operations: 0,
    medics: 0,
    trainingSessions: 0,
    emsOps: 0,
    rescueOps: 0,
    fireOps: 0,
    completedOps: 0,
  });
  const [centerChartData, setCenterChartData] = useState<{ name: string; operations: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [centersSnap, opsSnap, medicsSnap, trainingSnap] = await Promise.all([
          getDocs(collection(db, 'centers')),
          getDocs(collection(db, 'operations')),
          getDocs(collection(db, 'medics')),
          getDocs(collection(db, 'trainingSessions')),
        ]);

        const operations = opsSnap.docs.map((d) => d.data());
        const emsOps = operations.filter((o) => o.type === 'EMS').length;
        const rescueOps = operations.filter((o) => o.type === 'RESCUE').length;
        const fireOps = operations.filter((o) => o.type === 'FIRE').length;
        const completedOps = operations.length;

        setStats({
          centers: centersSnap.size,
          operations: opsSnap.size,
          medics: medicsSnap.size,
          trainingSessions: trainingSnap.size,
          emsOps,
          rescueOps,
          fireOps,
          completedOps,
        });

        // Center chart data
        const centerMap: Record<string, number> = {};
        operations.forEach((op) => {
          const name = op.centerName || 'غير محدد';
          centerMap[name] = (centerMap[name] || 0) + 1;
        });
        setCenterChartData(
          Object.entries(centerMap).map(([name, operations]) => ({ name, operations }))
        );
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const pieData = [
    { name: 'إسعاف', value: stats.emsOps, color: '#3b82f6' },
    { name: 'إنقاذ', value: stats.rescueOps, color: '#f59e0b' },
    { name: 'إطفاء', value: stats.fireOps, color: '#ef4444' },
  ];

  const statusData = [
    { name: 'إسعاف', value: stats.emsOps, color: '#3b82f6' },
    { name: 'إنقاذ', value: stats.rescueOps, color: '#f59e0b' },
    { name: 'إطفاء', value: stats.fireOps, color: '#ef4444' },
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
      {/* Brand Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl h-52 shadow-xl">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/risala.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-primary-950/80 via-primary-900/60 to-transparent" />
        <div className="relative h-full flex flex-col justify-end p-6">
          <p className="text-emerald-300 text-sm font-medium mb-1">المسؤول العام</p>
          <h1 className="text-3xl font-bold text-white">لوحة التحكم</h1>
          <p className="text-white/70 mt-1">مرحباً، {profile?.name}</p>
        </div>
      </div>

      {/* Install App */}
      {installPrompt && (
        <button
          onClick={async () => { installPrompt.prompt(); const r = await installPrompt.userChoice; if (r.outcome === 'accepted') setInstallPrompt(null); }}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-l from-primary-700 to-primary-600 text-white rounded-xl py-3 px-6 font-bold shadow-lg hover:from-primary-800 hover:to-primary-700 transition-all"
        >
          <Download size={20} />
          تثبيت التطبيق على جهازك
        </button>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="المراكز" value={stats.centers} icon={<Building2 size={24} />} color="blue" />
        <StatCard title="الحالات" value={stats.operations} icon={<Ambulance size={24} />} color="green" />
        <StatCard title="المسعفين" value={stats.medics} icon={<Users size={24} />} color="purple" />
        <StatCard title="التدريبات" value={stats.trainingSessions} icon={<GraduationCap size={24} />} color="orange" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operations by Type */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">الحالات حسب النوع</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operations by Center */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">الحالات حسب المركز</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={centerChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="operations" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">توزيع الحالات</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-s-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">ملخص سريع</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <span className="text-sm text-slate-600">حالات إسعاف</span>
              <span className="font-bold text-blue-600">{stats.emsOps}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
              <span className="text-sm text-slate-600">حالات إنقاذ</span>
              <span className="font-bold text-yellow-600">{stats.rescueOps}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <span className="text-sm text-slate-600">حالات إطفاء</span>
              <span className="font-bold text-red-600">{stats.fireOps}</span>
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

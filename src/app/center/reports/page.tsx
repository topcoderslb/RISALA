'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { Operation } from '@/lib/types';
import Button from '@/components/Button';
import { BarChart3, FileDown, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { exportReportToPDF } from '@/lib/pdf-utils';

export default function CenterReportsPage() {
  const { profile } = useAuth();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (!profile?.centerId) return;
    async function fetch() {
      try {
        const snap = await cachedGetDocs(query(collection(db, 'operations'), where('centerId', '==', profile!.centerId)), `operations:${profile!.centerId}`);
        setOperations(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Operation[]);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetch();
  }, [profile]);

  const monthlyOps = operations.filter((o) => o.date?.startsWith(selectedMonth));
  const emsCount = monthlyOps.filter((o) => o.type === 'EMS').length;
  const rescueCount = monthlyOps.filter((o) => o.type === 'RESCUE').length;

  const pieData = [
    { name: 'إسعاف', value: emsCount, color: '#3b82f6' },
    { name: 'إنقاذ', value: rescueCount, color: '#f59e0b' },
  ];

  // Daily breakdown for bar chart
  const dailyStats: Record<string, number> = {};
  monthlyOps.forEach((o) => {
    const day = o.date.split('-')[2];
    dailyStats[day] = (dailyStats[day] || 0) + 1;
  });
  const dailyData = Object.entries(dailyStats).map(([day, count]) => ({ day, count })).sort((a, b) => Number(a.day) - Number(b.day));

  const handleExport = () => {
    exportReportToPDF(
      `تقرير شهري - ${profile?.centerName} - ${selectedMonth}`,
      [
        { label: 'المركز', value: profile?.centerName || '' },
        { label: 'إجمالي الحالات', value: monthlyOps.length },
        { label: 'إسعاف', value: emsCount },
        { label: 'إنقاذ', value: rescueCount },
      ]
    );
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">تقارير المركز</h1>
        <p className="text-slate-500 mt-1">{profile?.centerName}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2">
          <Calendar size={16} className="text-slate-400" />
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="text-sm focus:outline-none" />
        </div>
        <Button onClick={handleExport} icon={<FileDown size={16} />} variant="secondary">تصدير PDF</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
          <p className="text-slate-500 text-sm">إجمالي الحالات</p>
          <p className="text-4xl font-bold text-primary-600 mt-2">{monthlyOps.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
          <p className="text-slate-500 text-sm">إسعاف</p>
          <p className="text-4xl font-bold text-blue-600 mt-2">{emsCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
          <p className="text-slate-500 text-sm">إنقاذ</p>
          <p className="text-4xl font-bold text-yellow-600 mt-2">{rescueCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-bold text-slate-800 mb-4">نوع الحالات</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-bold text-slate-800 mb-4">الحالات اليومية</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

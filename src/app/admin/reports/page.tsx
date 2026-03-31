'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs } from '@/lib/firebase-cache';
import { Operation } from '@/lib/types';
import Button from '@/components/Button';
import { BarChart3, FileDown, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { exportReportToPDF } from '@/lib/pdf-utils';

export default function AdminReportsPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    async function fetch() {
      try {
        const snap = await cachedGetDocs(collection(db, 'operations'), 'operations');
        setOperations(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Operation[]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  // Monthly report
  const monthlyOps = operations.filter((o) => o.date?.startsWith(selectedMonth));
  const monthlyEMS = monthlyOps.filter((o) => o.type === 'EMS').length;
  const monthlyRescue = monthlyOps.filter((o) => o.type === 'RESCUE').length;
  const monthlyCenterStats: Record<string, { total: number; ems: number; rescue: number }> = {};
  monthlyOps.forEach((o) => {
    if (!monthlyCenterStats[o.centerName]) monthlyCenterStats[o.centerName] = { total: 0, ems: 0, rescue: 0 };
    monthlyCenterStats[o.centerName].total++;
    if (o.type === 'EMS') monthlyCenterStats[o.centerName].ems++;
    else monthlyCenterStats[o.centerName].rescue++;
  });

  // Yearly report
  const yearlyOps = operations.filter((o) => o.date?.startsWith(String(selectedYear)));
  const yearlyCenterStats: Record<string, number> = {};
  yearlyOps.forEach((o) => {
    yearlyCenterStats[o.centerName] = (yearlyCenterStats[o.centerName] || 0) + 1;
  });
  const mostActive = Object.entries(yearlyCenterStats).sort((a, b) => b[1] - a[1])[0];

  const pieData = [
    { name: 'إسعاف', value: monthlyEMS, color: '#3b82f6' },
    { name: 'إنقاذ', value: monthlyRescue, color: '#f59e0b' },
  ];

  const centerBarData = Object.entries(view === 'monthly' ? monthlyCenterStats : yearlyCenterStats)
    .map(([name, data]) => ({
      name,
      total: typeof data === 'number' ? data : data.total,
    }));

  const handleExportMonthlyPDF = () => {
    exportReportToPDF(
      `تقرير شهري - ${selectedMonth}`,
      [
        { label: 'إجمالي الحالات', value: monthlyOps.length },
        { label: 'عمليات إسعاف', value: monthlyEMS },
        { label: 'عمليات إنقاذ', value: monthlyRescue },
      ],
      Object.entries(monthlyCenterStats).map(([name, s]) => ({ name, value: s.total }))
    );
  };

  const handleExportYearlyPDF = () => {
    exportReportToPDF(
      `تقرير سنوي - ${selectedYear}`,
      [
        { label: 'إجمالي الحالات', value: yearlyOps.length },
        { label: 'أكثر مركز نشاطاً', value: mostActive ? `${mostActive[0]} (${mostActive[1]})` : 'لا يوجد' },
      ],
      Object.entries(yearlyCenterStats).map(([name, total]) => ({ name, value: total }))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">التقارير والإحصائيات</h1>
          <p className="text-slate-500 mt-1">تقارير شهرية وسنوية</p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('monthly')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            view === 'monthly' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          تقرير شهري
        </button>
        <button
          onClick={() => setView('yearly')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            view === 'yearly' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          تقرير سنوي
        </button>
      </div>

      {view === 'monthly' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2">
              <Calendar size={16} className="text-slate-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm focus:outline-none"
              />
            </div>
            <Button onClick={handleExportMonthlyPDF} icon={<FileDown size={16} />} variant="secondary">
              تصدير PDF
            </Button>
          </div>

          {/* Monthly Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
              <p className="text-slate-500 text-sm">إجمالي الحالات</p>
              <p className="text-4xl font-bold text-primary-600 mt-2">{monthlyOps.length}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
              <p className="text-slate-500 text-sm">إسعاف</p>
              <p className="text-4xl font-bold text-blue-600 mt-2">{monthlyEMS}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
              <p className="text-slate-500 text-sm">إنقاذ</p>
              <p className="text-4xl font-bold text-yellow-600 mt-2">{monthlyRescue}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 mb-4">النوع</h3>
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
              <h3 className="font-bold text-slate-800 mb-4">حسب المركز</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={centerBarData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Center details table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-bold text-slate-800 mb-4">تفاصيل المراكز</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-right py-2 text-xs text-slate-500">المركز</th>
                  <th className="text-right py-2 text-xs text-slate-500">الإجمالي</th>
                  <th className="text-right py-2 text-xs text-slate-500">إسعاف</th>
                  <th className="text-right py-2 text-xs text-slate-500">إنقاذ</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(monthlyCenterStats).map(([name, s]) => (
                  <tr key={name} className="border-b border-slate-50">
                    <td className="py-2 text-sm font-medium">{name}</td>
                    <td className="py-2 text-sm">{s.total}</td>
                    <td className="py-2 text-sm text-blue-600">{s.ems}</td>
                    <td className="py-2 text-sm text-yellow-600">{s.rescue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2">
              <Calendar size={16} className="text-slate-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-sm focus:outline-none"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleExportYearlyPDF} icon={<FileDown size={16} />} variant="secondary">
              تصدير PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
              <p className="text-slate-500 text-sm">إجمالي الحالات</p>
              <p className="text-4xl font-bold text-primary-600 mt-2">{yearlyOps.length}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
              <p className="text-slate-500 text-sm">أكثر مركز نشاطاً</p>
              <p className="text-xl font-bold text-green-600 mt-2">
                {mostActive ? `${mostActive[0]} (${mostActive[1]} عملية)` : 'لا يوجد بيانات'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-bold text-slate-800 mb-4">مقارنة المراكز</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={centerBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

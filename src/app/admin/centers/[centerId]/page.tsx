'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Center, Operation, Medic, Schedule } from '@/lib/types';
import StatCard from '@/components/StatCard';
import Button from '@/components/Button';
import { ArrowRight, Ambulance, Users, Calendar, Activity, Eye, FileDown, ImageIcon, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { exportOperationToPDF, exportOperationToImage } from '@/lib/pdf-utils';

type Tab = 'dashboard' | 'operations' | 'medics' | 'schedules';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function CenterImpersonationPage() {
  const { centerId } = useParams<{ centerId: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [center, setCenter] = useState<Center | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [medics, setMedics] = useState<Medic[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedOp, setSelectedOp] = useState<Operation | null>(null);

  useEffect(() => {
    if (!centerId || profile?.role !== 'superadmin') return;
    fetchCenterData();
  }, [centerId, profile]);

  async function fetchCenterData() {
    try {
      const [centerDoc, opsSnap, medicsSnap, schedSnap] = await Promise.all([
        getDoc(doc(db, 'centers', centerId)),
        getDocs(query(collection(db, 'operations'), where('centerId', '==', centerId))),
        getDocs(query(collection(db, 'medics'), where('centerId', '==', centerId))),
        getDocs(query(collection(db, 'schedules'), where('centerId', '==', centerId))),
      ]);

      if (centerDoc.exists()) {
        setCenter({ id: centerDoc.id, ...centerDoc.data() } as Center);
      }
      const ops = opsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Operation[];
      ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOperations(ops);
      setMedics(medicsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Medic[]);
      setSchedules(schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Schedule[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!center) {
    return (
      <div className="text-center py-12">
        <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
        <p className="text-slate-400">المركز غير موجود</p>
        <Button variant="secondary" onClick={() => router.push('/admin/centers')} className="mt-4">
          العودة للمراكز
        </Button>
      </div>
    );
  }

  const emsOps = operations.filter((o) => o.type === 'EMS').length;
  const rescueOps = operations.filter((o) => o.type === 'RESCUE').length;
  const fireOps = operations.filter((o) => o.type === 'FIRE').length;
  const activeMedics = medics.filter((m) => m.status === 'active').length;

  const pieData = [
    { name: 'إسعاف', value: emsOps, color: '#3b82f6' },
    { name: 'إنقاذ', value: rescueOps, color: '#f59e0b' },
    { name: 'إطفاء', value: fireOps, color: '#ef4444' },
  ];

  const roleLabels: Record<string, string> = { medic: 'مسعف', driver: 'سائق', leader: 'قائد' };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'نظرة عامة', icon: <Activity size={16} /> },
    { key: 'operations', label: 'الحالات', icon: <Ambulance size={16} /> },
    { key: 'medics', label: 'المسعفين', icon: <Users size={16} /> },
    { key: 'schedules', label: 'الجداول', icon: <Calendar size={16} /> },
  ];

  const groupedByDay: Record<string, Schedule[]> = {};
  DAYS.forEach((day) => { groupedByDay[day] = schedules.filter((s) => s.dayOfWeek === day); });

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-xl">
            <Building2 size={24} className="text-primary-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary-800">{center.name}</h1>
            <p className="text-xs text-primary-600">وضع المعاينة - عرض بيانات المركز</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => router.push('/admin/centers')} icon={<ArrowRight size={16} />}>
          العودة للمراكز
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-xl border border-slate-200 p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="الحالات" value={operations.length} icon={<Ambulance size={24} />} color="blue" />
            <StatCard title="المسعفين" value={medics.length} icon={<Users size={24} />} color="green" />
            <StatCard title="الجداول" value={schedules.length} icon={<Calendar size={24} />} color="purple" />
            <StatCard title="إطفاء" value={fireOps} icon={<Activity size={24} />} color="orange" />
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
                  <span className="text-sm text-slate-600">حالات إسعاف</span>
                  <span className="font-bold text-blue-600">{emsOps}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                  <span className="text-sm text-slate-600">حالات إنقاذ</span>
                  <span className="font-bold text-yellow-600">{rescueOps}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                  <span className="text-sm text-slate-600">حالات إطفاء</span>
                  <span className="font-bold text-red-600">{fireOps}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <span className="text-sm text-slate-600">مسعفين نشطين</span>
                  <span className="font-bold text-green-600">{activeMedics}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">رقم الحالة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">رقم الموافقة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">اسم الحالة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">النوع</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">التاريخ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {operations.map((op) => (
                  <tr key={op.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{op.caseId}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{op.approvalNumber}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{op.caseName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        op.type === 'EMS' ? 'bg-blue-100 text-blue-700' :
                        op.type === 'FIRE' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {op.type === 'EMS' ? 'إسعاف' : op.type === 'FIRE' ? 'إطفاء' : 'إنقاذ'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{op.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedOp(op)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Eye size={16} /></button>
                        <button onClick={() => exportOperationToPDF(op)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title="تصدير PDF"><FileDown size={16} /></button>
                        <button onClick={() => exportOperationToImage(op)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title="تصدير صورة"><ImageIcon size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {operations.length === 0 && (
            <div className="text-center py-12">
              <Ambulance size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">لا توجد حالات</p>
            </div>
          )}
        </div>
      )}

      {/* Medics Tab */}
      {activeTab === 'medics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {medics.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow animate-fade-in">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${m.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}>
                  {m.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{m.name}</h3>
                  <p className="text-xs text-slate-400" dir="ltr">{m.phone || 'لا يوجد رقم'}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{roleLabels[m.role]}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {m.status === 'active' ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            </div>
          ))}
          {medics.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Users size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">لا يوجد مسعفين</p>
            </div>
          )}
        </div>
      )}

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS.map((day) => (
            <div key={day} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
              <div className="bg-primary-50 px-4 py-3 border-b border-primary-100">
                <h3 className="font-bold text-primary-800">{day}</h3>
              </div>
              <div className="p-4 space-y-3">
                {groupedByDay[day].length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">لا يوجد مناوبات</p>
                ) : (
                  groupedByDay[day].map((s) => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-sm font-medium text-slate-700">{s.timeFrom} - {s.timeTo}</span>
                      {s.assignedMedicNames && s.assignedMedicNames.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.assignedMedicNames.map((name, i) => (
                            <span key={i} className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Operation Detail Modal */}
      {selectedOp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOp(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">تفاصيل - {selectedOp.caseId}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-slate-400">رقم الحالة</p><p className="font-medium">{selectedOp.caseId}</p></div>
                <div><p className="text-xs text-slate-400">رقم الموافقة</p><p className="font-medium">{selectedOp.approvalNumber}</p></div>
                <div><p className="text-xs text-slate-400">النوع</p><p className="font-medium">{selectedOp.type === 'EMS' ? 'إسعاف' : selectedOp.type === 'FIRE' ? 'إطفاء' : 'إنقاذ'}</p></div>
                <div><p className="text-xs text-slate-400">التاريخ</p><p className="font-medium">{selectedOp.date}</p></div>
                <div><p className="text-xs text-slate-400">الوقت</p><p className="font-medium">{selectedOp.time}</p></div>
              </div>
              {selectedOp.memberNames && selectedOp.memberNames.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">الأعضاء</p>
                  <div className="flex flex-wrap gap-2">{selectedOp.memberNames.map((n, i) => <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded-full">{n}</span>)}</div>
                </div>
              )}
              {selectedOp.report && <div><p className="text-xs text-slate-400 mb-1">التقرير</p><p className="text-sm bg-slate-50 p-3 rounded-xl">{selectedOp.report}</p></div>}
              {selectedOp.images && selectedOp.images.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">الصور</p>
                  <div className="flex flex-wrap gap-2">{selectedOp.images.map((url, i) => <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover" loading="lazy" />)}</div>
                </div>
              )}
              <button onClick={() => setSelectedOp(null)} className="w-full mt-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

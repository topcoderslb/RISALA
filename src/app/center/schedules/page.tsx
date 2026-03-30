'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Schedule, Medic } from '@/lib/types';
import { logAudit } from '@/lib/audit';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import { Calendar, Plus, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function CenterSchedulesPage() {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [medics, setMedics] = useState<Medic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    dayOfWeek: DAYS[0],
    timeFrom: '08:00',
    timeTo: '20:00',
    assignedMedics: [] as string[],
  });

  useEffect(() => {
    if (!profile?.centerId) return;
    fetchData();
  }, [profile]);

  async function fetchData() {
    try {
      const [schedSnap, medicsSnap] = await Promise.all([
        getDocs(query(collection(db, 'schedules'), where('centerId', '==', profile!.centerId))),
        getDocs(query(collection(db, 'medics'), where('centerId', '==', profile!.centerId))),
      ]);
      setSchedules(schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Schedule[]);
      setMedics((medicsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Medic[]).filter((m) => m.status === 'active'));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const openCreate = () => {
    setEditing(null);
    setForm({ dayOfWeek: DAYS[0], timeFrom: '08:00', timeTo: '20:00', assignedMedics: [] });
    setShowModal(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({ dayOfWeek: s.dayOfWeek, timeFrom: s.timeFrom, timeTo: s.timeTo, assignedMedics: s.assignedMedics || [] });
    setShowModal(true);
  };

  const toggleMedic = (id: string) => {
    setForm((prev) => ({
      ...prev,
      assignedMedics: prev.assignedMedics.includes(id)
        ? prev.assignedMedics.filter((m) => m !== id)
        : [...prev.assignedMedics, id],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const medicNames = form.assignedMedics.map((id) => medics.find((m) => m.id === id)?.name || id);

      if (editing) {
        await updateDoc(doc(db, 'schedules', editing.id), {
          dayOfWeek: form.dayOfWeek,
          timeFrom: form.timeFrom,
          timeTo: form.timeTo,
          assignedMedics: form.assignedMedics,
          assignedMedicNames: medicNames,
          updatedAt: now,
        });
        toast.success('تم التحديث');
        logAudit(profile, 'update', 'schedules', `تعديل جدول: ${form.dayOfWeek}`, editing.id);
      } else {
        await addDoc(collection(db, 'schedules'), {
          centerId: profile!.centerId,
          dayOfWeek: form.dayOfWeek,
          timeFrom: form.timeFrom,
          timeTo: form.timeTo,
          assignedMedics: form.assignedMedics,
          assignedMedicNames: medicNames,
          createdAt: now,
          updatedAt: now,
          createdBy: profile!.uid,
        });
        toast.success('تم الإضافة');
        logAudit(profile, 'create', 'schedules', `إضافة جدول جديد: ${form.dayOfWeek}`);
      }
      setShowModal(false);
      fetchData();
    } catch (error) { console.error(error); toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>;

  // Group schedules by day
  const groupedByDay: Record<string, Schedule[]> = {};
  DAYS.forEach((day) => { groupedByDay[day] = schedules.filter((s) => s.dayOfWeek === day); });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الجداول</h1>
          <p className="text-slate-500 mt-1">جداول المناوبات الأسبوعية</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={18} />}>إضافة جدول</Button>
      </div>

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
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">{s.timeFrom} - {s.timeTo}</span>
                      <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-slate-200 text-slate-400">
                        <Edit size={14} />
                      </button>
                    </div>
                    {s.assignedMedicNames && s.assignedMedicNames.length > 0 && (
                      <div className="flex flex-wrap gap-1">
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل جدول' : 'إضافة جدول جديد'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">اليوم</label>
            <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">من</label>
              <input type="time" value={form.timeFrom} onChange={(e) => setForm({ ...form, timeFrom: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">إلى</label>
              <input type="time" value={form.timeTo} onChange={(e) => setForm({ ...form, timeTo: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">المسعفين المعينين</label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
              {medics.map((m) => (
                <button key={m.id} type="button" onClick={() => toggleMedic(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    form.assignedMedics.includes(m.id) ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-300'
                  }`}>
                  {m.name}
                </button>
              ))}
              {medics.length === 0 && <p className="text-xs text-slate-400">لا يوجد مسعفين</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} loading={saving}>{editing ? 'تحديث' : 'إضافة'}</Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

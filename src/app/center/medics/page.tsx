'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs, invalidateCachePrefix } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { Medic } from '@/lib/types';
import { logAudit } from '@/lib/audit';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import SearchFilter from '@/components/SearchFilter';
import { Users, Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CenterMedicsPage() {
  const { profile } = useAuth();
  const [medics, setMedics] = useState<Medic[]>([]);
  const [filtered, setFiltered] = useState<Medic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Medic | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', role: 'medic' as 'medic' | 'driver' | 'trainer', status: 'active' as 'active' | 'inactive', birthDate: '', notes: '' });

  useEffect(() => {
    if (!profile?.centerId) return;
    fetchMedics();
  }, [profile]);

  async function fetchMedics() {
    invalidateCachePrefix('medics');
    try {
      const snap = await cachedGetDocs(query(collection(db, 'medics'), where('centerId', '==', profile!.centerId)), `medics:${profile!.centerId}`);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Medic[];
      setMedics(data);
      setFiltered(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  const handleSearch = (term: string) => {
    if (!term) { setFiltered(medics); return; }
    const lower = term.toLowerCase();
    setFiltered(medics.filter((m) => m.name.toLowerCase().includes(lower) || m.phone.includes(term)));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', phone: '', role: 'medic', status: 'active', birthDate: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (m: Medic) => {
    setEditing(m);
    setForm({ name: m.name, phone: m.phone, role: m.role, status: m.status, birthDate: m.birthDate || '', notes: m.notes || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editing) {
        await updateDoc(doc(db, 'medics', editing.id), { name: form.name.trim(), phone: form.phone.trim(), role: form.role, status: form.status, birthDate: form.birthDate, notes: form.notes.trim(), updatedAt: now });
        toast.success('تم التحديث');
        logAudit(profile, 'update', 'medics', `تعديل مسعف: ${form.name}`, editing.id);
      } else {
        await addDoc(collection(db, 'medics'), {
          centerId: profile!.centerId,
          centerName: profile!.centerName || '',
          name: form.name.trim(),
          phone: form.phone.trim(),
          role: form.role,
          status: form.status,
          birthDate: form.birthDate,
          notes: form.notes.trim(),
          createdAt: now,
          updatedAt: now,
          createdBy: profile!.uid,
        });
        toast.success('تم الإضافة');
        logAudit(profile, 'create', 'medics', `إضافة مسعف جديد: ${form.name}`);
      }
      setShowModal(false);
      fetchMedics();
    } catch (error) { console.error(error); toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  const handleDelete = async (medic: Medic) => {
    if (!confirm(`حذف المسعف "${medic.name}"؟`)) return;
    try {
      // Remove medic from all duty schedules in the center
      const schedSnap = await getDocs(query(collection(db, 'schedules'), where('centerId', '==', profile!.centerId)));
      const scheduleUpdates = schedSnap.docs
        .filter((d) => (d.data().assignedMedics || []).includes(medic.id))
        .map((d) =>
          updateDoc(doc(db, 'schedules', d.id), {
            assignedMedics: arrayRemove(medic.id),
            assignedMedicNames: arrayRemove(medic.name),
          })
        );
      await Promise.all(scheduleUpdates);
      await deleteDoc(doc(db, 'medics', medic.id));
      toast.success('تم الحذف');
      logAudit(profile, 'delete', 'medics', `حذف مسعف: ${medic.name}`, medic.id);
      fetchMedics();
    } catch { toast.error('خطأ في الحذف'); }
  };

  const roleLabels: Record<string, string> = { medic: 'مسعف', driver: 'سائق', trainer: 'مدرب' };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">المسعفون</h1>
          <p className="text-slate-500 mt-1">إدارة فريق المركز</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={18} />}>إضافة مسعف</Button>
      </div>

      <SearchFilter searchPlaceholder="بحث بالاسم أو الهاتف..." onSearch={handleSearch}
        filters={[
          { label: 'الدور', key: 'role', options: [{ label: 'مسعف', value: 'medic' }, { label: 'سائق', value: 'driver' }, { label: 'مدرب', value: 'trainer' }] },
          { label: 'الحالة', key: 'status', options: [{ label: 'نشط', value: 'active' }, { label: 'غير نشط', value: 'inactive' }] },
        ]}
        onFilterChange={(filters) => {
          let result = [...medics];
          if (filters.role) result = result.filter((m) => m.role === filters.role);
          if (filters.status) result = result.filter((m) => m.status === filters.status);
          setFiltered(result);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${m.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}>
                  {m.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{m.name}</h3>
                  <p className="text-xs text-slate-400" dir="ltr">{m.phone || 'لا يوجد رقم'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Edit size={16} /></button>
                <button onClick={() => handleDelete(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{roleLabels[m.role]}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {m.status === 'active' ? 'نشط' : 'غير نشط'}
              </span>
            </div>
            {m.birthDate && <p className="text-xs text-slate-400 mt-2">تاريخ الميلاد: {m.birthDate}</p>}
            {m.notes && <p className="text-xs text-slate-500 mt-1 italic">{m.notes}</p>}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">لا يوجد مسعفون</p>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل مسعف' : 'إضافة مسعف جديد'}>
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            يجب إدخال الاسم الثلاثي للمسعف كاملاً
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الاسم الثلاثي *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: أحمد محمد عبدالله"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">تاريخ الميلاد</label>
            <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الهاتف</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الدور</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'medic' | 'driver' | 'trainer' })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="medic">مسعف</option>
              <option value="driver">سائق</option>
              <option value="trainer">مدرب</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الحالة</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">ملاحظات <span className="text-slate-400 font-normal">(مثل: المستوى التعليمي، الدورات، غيرها)</span></label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} placeholder="أضف أي معلومات إضافية عن المسعف..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
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

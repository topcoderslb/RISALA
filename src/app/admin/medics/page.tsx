'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs, invalidateCachePrefix } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { Medic, Center } from '@/lib/types';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import SearchFilter from '@/components/SearchFilter';
import Pagination from '@/components/Pagination';
import { Users, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminMedicsPage() {
  const { profile } = useAuth();
  const [medics, setMedics] = useState<Medic[]>([]);
  const [filtered, setFiltered] = useState<Medic[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ centerId: '', name: '', phone: '', role: 'medic' as 'medic' | 'driver' | 'trainer', status: 'active' as 'active' | 'inactive', birthDate: '', notes: '' });
  const pageSize = 20;

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    invalidateCachePrefix('medics');
    try {
      const [medicsSnap, centersSnap] = await Promise.all([
        cachedGetDocs(collection(db, 'medics'), 'medics'),
        cachedGetDocs(collection(db, 'centers'), 'centers'),
      ]);
      const data = medicsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Medic[];
      setMedics(data);
      setFiltered(data);
      setCenters(centersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Center[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const openCreate = () => {
    setForm({ centerId: '', name: '', phone: '', role: 'medic', status: 'active', birthDate: '', notes: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return; }
    if (!form.centerId) { toast.error('يرجى اختيار المركز'); return; }
    setSaving(true);
    try {
      const center = centers.find((c) => c.id === form.centerId);
      const now = new Date().toISOString();
      await addDoc(collection(db, 'medics'), {
        centerId: form.centerId,
        centerName: center?.name || '',
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        status: form.status,
        birthDate: form.birthDate,
        notes: form.notes.trim(),
        createdAt: now,
        updatedAt: now,
        createdBy: profile?.uid || '',
      });
      toast.success('تم الإضافة');
      setShowModal(false);
      fetchData();
    } catch (error) { console.error(error); toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  const handleSearch = (term: string) => {
    if (!term) { setFiltered(medics); setCurrentPage(1); return; }
    const lower = term.toLowerCase();
    setFiltered(medics.filter((m) =>
      m.name.toLowerCase().includes(lower) ||
      m.phone.includes(term) ||
      (m.centerName && m.centerName.toLowerCase().includes(lower))
    ));
    setCurrentPage(1);
  };

  const centerNames = Array.from(new Set(medics.map((m) => m.centerName).filter(Boolean)));

  const handleFilter = (filters: Record<string, string>) => {
    let result = [...medics];
    if (filters.role) result = result.filter((m) => m.role === filters.role);
    if (filters.status) result = result.filter((m) => m.status === filters.status);
    if (filters.center) result = result.filter((m) => m.centerName === filters.center);
    setFiltered(result);
    setCurrentPage(1);
  };

  const handleDelete = async (medic: Medic) => {
    if (!confirm(`حذف المسعف "${medic.name}"؟`)) return;
    try {
      await deleteDoc(doc(db, 'medics', medic.id));
      toast.success('تم الحذف');
      fetchData();
    } catch { toast.error('خطأ'); }
  };

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const roleLabels: Record<string, string> = { medic: 'مسعف', driver: 'سائق', trainer: 'مدرب' };
  const statusLabels: Record<string, string> = { active: 'نشط', inactive: 'غير نشط' };

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
          <h1 className="text-2xl font-bold text-slate-800">المسعفين</h1>
          <p className="text-slate-500 mt-1">جميع المسعفين من كافة المراكز</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={18} />}>إضافة مسعف</Button>
      </div>

      <SearchFilter
        searchPlaceholder="بحث بالاسم أو الهاتف أو المركز..."
        onSearch={handleSearch}
        filters={[
          {
            label: 'الدور',
            key: 'role',
            options: [
              { label: 'مسعف', value: 'medic' },
              { label: 'سائق', value: 'driver' },
              { label: 'مدرب', value: 'trainer' },
            ],
          },
          {
            label: 'الحالة',
            key: 'status',
            options: [
              { label: 'نشط', value: 'active' },
              { label: 'غير نشط', value: 'inactive' },
            ],
          },
          {
            label: 'المركز',
            key: 'center',
            options: centerNames.map((n) => ({ label: n, value: n })),
          },
        ]}
        onFilterChange={handleFilter}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">الاسم</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">الهاتف</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">المركز</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">الدور</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">الحالة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{m.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600" dir="ltr">{m.phone}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
                      {m.centerName || 'غير محدد'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                      {roleLabels[m.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {statusLabels[m.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginated.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400">لا يوجد مسعفين</p>
          </div>
        )}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="إضافة مسعف جديد">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            يجب إدخال الاسم الثلاثي للمسعف كاملاً
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">المركز *</label>
            <select value={form.centerId} onChange={(e) => setForm({ ...form, centerId: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">اختر المركز</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
            <label className="block text-sm font-medium text-slate-600 mb-1.5">ملاحظات</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} placeholder="أضف أي معلومات إضافية عن المسعف..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} loading={saving}>إضافة</Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

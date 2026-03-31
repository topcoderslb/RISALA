'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs, invalidateCachePrefix } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { Operation, Medic, Center } from '@/lib/types';
import SearchFilter from '@/components/SearchFilter';
import Button from '@/components/Button';
import Pagination from '@/components/Pagination';
import Modal from '@/components/Modal';
import ImageUpload from '@/components/ImageUpload';
import { Ambulance, Trash2, Eye, FileDown, Plus, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportOperationToPDF, exportOperationToImage } from '@/lib/pdf-utils';

export default function AdminOperationsPage() {
  const { profile } = useAuth();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [filtered, setFiltered] = useState<Operation[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [medics, setMedics] = useState<Medic[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOp, setSelectedOp] = useState<Operation | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const pageSize = 15;

  const [form, setForm] = useState({
    approvalNumber: '',
    type: 'EMS' as 'EMS' | 'RESCUE' | 'FIRE',
    caseName: '',
    date: '',
    time: '',
    location: '',
    vehicleType: '',
    vehicleNumber: '',
    members: [] as string[],
    report: '',
    images: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    invalidateCachePrefix('operations');
    try {
      const [opsSnap, centersSnap] = await Promise.all([
        cachedGetDocs(collection(db, 'operations'), 'operations'),
        cachedGetDocs(collection(db, 'centers'), 'centers'),
      ]);
      const data = opsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Operation[];
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOperations(data);
      setFiltered(data);
      setCenters(centersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Center[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  // Fetch medics when center is selected in the create form
  useEffect(() => {
    if (!selectedCenterId) { setMedics([]); return; }
    async function fetchCenterMedics() {
      const snap = await cachedGetDocs(query(collection(db, 'medics'), where('centerId', '==', selectedCenterId)), `medics:${selectedCenterId}`);
      const meds = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Medic[];
      setMedics(meds.filter((m) => m.status === 'active'));
    }
    fetchCenterMedics();
  }, [selectedCenterId]);

  const generateCaseId = async (centerId: string, centerName: string): Promise<string> => {
    const opsSnap = await cachedGetDocs(query(collection(db, 'operations'), where('centerId', '==', centerId)), `operations:${centerId}`);
    const seq = opsSnap.size + 1;
    return `ALRISALA-${centerName}-${seq.toString().padStart(4, '0')}`;
  };

  const openCreateModal = () => {
    setSelectedCenterId('');
    setForm({
      approvalNumber: '',
      type: 'EMS',
      caseName: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      location: '',
      vehicleType: '',
      vehicleNumber: '',
      members: [],
      report: '',
      images: [],
    });
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!selectedCenterId) { toast.error('يرجى اختيار المركز'); return; }
    if (!form.approvalNumber.trim()) { toast.error('رقم الموافقة مطلوب'); return; }
    if (!form.caseName.trim()) { toast.error('اسم الحالة مطلوب'); return; }
    setSaving(true);
    try {
      const center = centers.find((c) => c.id === selectedCenterId);
      const centerName = center?.name || 'مركز';
      const caseId = await generateCaseId(selectedCenterId, centerName);
      const memberNames = form.members.map((id) => medics.find((m) => m.id === id)?.name || id);
      const now = new Date().toISOString();

      await addDoc(collection(db, 'operations'), {
        caseId,
        centerId: selectedCenterId,
        centerName,
        approvalNumber: form.approvalNumber.trim(),
        type: form.type,
        caseName: form.caseName.trim(),
        date: form.date,
        time: form.time,
        location: form.location.trim(),
        vehicleType: form.vehicleType.trim(),
        vehicleNumber: form.vehicleNumber.trim(),
        members: form.members,
        memberNames,
        report: form.report,
        images: form.images,
        status: 'completed',
        createdAt: now,
        updatedAt: now,
        createdBy: profile?.uid || '',
      });
      toast.success('تم إضافة الحالة');
      setShowCreateModal(false);
      fetchData();
    } catch (error) { console.error(error); toast.error('حدث خطأ'); } finally { setSaving(false); }
  };

  const toggleMember = (medicId: string) => {
    setForm((prev) => ({
      ...prev,
      members: prev.members.includes(medicId)
        ? prev.members.filter((id) => id !== medicId)
        : [...prev.members, medicId],
    }));
  };

  const handleSearch = (term: string) => {
    if (!term) { setFiltered(operations); setCurrentPage(1); return; }
    const lower = term.toLowerCase();
    setFiltered(operations.filter((o) =>
      o.caseName.toLowerCase().includes(lower) ||
      o.caseId.toLowerCase().includes(lower) ||
      o.approvalNumber.toLowerCase().includes(lower) ||
      o.centerName.toLowerCase().includes(lower)
    ));
    setCurrentPage(1);
  };

  const handleFilter = (filters: Record<string, string>) => {
    let result = [...operations];
    if (filters.type) result = result.filter((o) => o.type === filters.type);
    if (filters.center) result = result.filter((o) => o.centerName === filters.center);
    setFiltered(result);
    setCurrentPage(1);
  };

  const handleDateFilter = (from: string, to: string) => {
    if (!from || !to) { setFiltered(operations); return; }
    setFiltered(operations.filter((o) => o.date >= from && o.date <= to));
    setCurrentPage(1);
  };

  const handleDelete = async (op: Operation) => {
    if (!confirm('هل أنت متأكد من حذف هذه الحالة؟')) return;
    try {
      await deleteDoc(doc(db, 'operations', op.id));
      toast.success('تم حذف الحالة');
      fetchData();
    } catch { toast.error('حدث خطأ'); }
  };

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedOps = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const centerNames = Array.from(new Set(operations.map((o) => o.centerName)));

  const typeLabel = (type: string) => {
    if (type === 'EMS') return { label: 'إسعاف', color: 'bg-blue-100 text-blue-700' };
    if (type === 'FIRE') return { label: 'إطفاء', color: 'bg-red-100 text-red-700' };
    return { label: 'إنقاذ', color: 'bg-orange-100 text-orange-700' };
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
          <h1 className="text-2xl font-bold text-slate-800">الحالات</h1>
          <p className="text-slate-500 mt-1">جميع الحالات من كافة المراكز</p>
        </div>
        <Button onClick={openCreateModal} icon={<Plus size={18} />}>إضافة حالة</Button>
      </div>

      <SearchFilter
        searchPlaceholder="بحث بالاسم أو رقم الحالة أو رقم الموافقة..."
        onSearch={handleSearch}
        dateFilter
        onDateFilter={handleDateFilter}
        filters={[
          {
            label: 'النوع',
            key: 'type',
            options: [
              { label: 'إسعاف', value: 'EMS' },
              { label: 'إطفاء', value: 'FIRE' },
              { label: 'إنقاذ', value: 'RESCUE' },
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

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">رقم الحالة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">رقم الموافقة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">اسم الحالة</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">النوع</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">المركز</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOps.map((op) => (
                <tr key={op.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">{op.caseId}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{op.approvalNumber}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{op.caseName}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${typeLabel(op.type).color}`}>
                      {typeLabel(op.type).label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{op.centerName}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{op.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedOp(op)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => exportOperationToPDF(op)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title="تصدير PDF">
                        <FileDown size={16} />
                      </button>
                      <button onClick={() => exportOperationToImage(op)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title="تصدير صورة">
                        <ImageIcon size={16} />
                      </button>
                      <button onClick={() => handleDelete(op)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedOps.length === 0 && (
          <div className="text-center py-12">
            <Ambulance size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-400">لا توجد حالات</p>
          </div>
        )}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedOp}
        onClose={() => setSelectedOp(null)}
        title={selectedOp ? `تفاصيل الحالة - ${selectedOp.caseId}` : ''}
        size="lg"
      >
        {selectedOp && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">رقم الحالة</p>
                <p className="font-medium">{selectedOp.caseId}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">رقم الموافقة</p>
                <p className="font-medium">{selectedOp.approvalNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">النوع</p>
                <p className="font-medium">{typeLabel(selectedOp.type).label}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">التاريخ</p>
                <p className="font-medium">{selectedOp.date}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">الوقت</p>
                <p className="font-medium">{selectedOp.time}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">المركز</p>
                <p className="font-medium">{selectedOp.centerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">الموقع</p>
                <p className="font-medium">{selectedOp.location || 'غير محدد'}</p>
              </div>
              {selectedOp.vehicleType && (
                <div>
                  <p className="text-xs text-slate-400">نوع السيارة</p>
                  <p className="font-medium">{selectedOp.vehicleType}</p>
                </div>
              )}
              {selectedOp.vehicleNumber && (
                <div>
                  <p className="text-xs text-slate-400">رقم السيارة</p>
                  <p className="font-medium" dir="ltr">{selectedOp.vehicleNumber}</p>
                </div>
              )}
            </div>

            {selectedOp.memberNames && selectedOp.memberNames.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1">الأعضاء</p>
                <div className="flex flex-wrap gap-2">
                  {selectedOp.memberNames.map((name, i) => (
                    <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded-full">{name}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedOp.report && (
              <div>
                <p className="text-xs text-slate-400 mb-1">نوع الحالة</p>
                <p className="text-sm bg-slate-50 p-3 rounded-xl">{selectedOp.report}</p>
              </div>
            )}

            {selectedOp.images && selectedOp.images.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">الصور</p>
                <div className="flex flex-wrap gap-2">
                  {selectedOp.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover" loading="lazy" />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={() => exportOperationToPDF(selectedOp)} icon={<FileDown size={16} />}>
                تصدير PDF
              </Button>
              <Button onClick={() => exportOperationToImage(selectedOp)} icon={<ImageIcon size={16} />} variant="secondary">
                تصدير صورة
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="إضافة حالة جديدة" size="xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">المركز *</label>
            <select value={selectedCenterId} onChange={(e) => { setSelectedCenterId(e.target.value); setForm((f) => ({ ...f, members: [] })); }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">اختر المركز</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">رقم الموافقة *</label>
              <input type="text" value={form.approvalNumber} onChange={(e) => setForm({ ...form, approvalNumber: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">النوع *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'EMS' | 'RESCUE' | 'FIRE' })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="EMS">إسعاف</option>
                <option value="FIRE">إطفاء</option>
                <option value="RESCUE">إنقاذ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">اسم الحالة *</label>
              <input type="text" value={form.caseName} onChange={(e) => setForm({ ...form, caseName: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">التاريخ</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">الوقت</label>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الموقع</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">نوع السيارة</label>
              <input type="text" value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                placeholder="مثال: سيارة إسعاف - تويوتا هايلكس"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">رقم السيارة</label>
              <input type="text" value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                placeholder="مثال: أ ب ج 1234"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" dir="ltr" />
            </div>
          </div>

          {/* Members Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الأعضاء {selectedCenterId ? '' : '(اختر المركز أولاً)'}</label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
              {medics.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    form.members.includes(m.id)
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-300'
                  }`}
                >
                  {m.name}
                </button>
              ))}
              {selectedCenterId && medics.length === 0 && <p className="text-xs text-slate-400">لا يوجد مسعفين نشطين في هذا المركز</p>}
              {!selectedCenterId && <p className="text-xs text-slate-400">يرجى اختيار المركز أولاً لعرض المسعفين</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">نوع الحالة</label>
            <textarea value={form.report} onChange={(e) => setForm({ ...form, report: e.target.value })}
              rows={4} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الصور (اختياري)</label>
            <ImageUpload images={form.images} onChange={(images) => setForm({ ...form, images })} />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleCreate} loading={saving}>إضافة</Button>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

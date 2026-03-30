'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { TrainingFile, TrainingSession } from '@/lib/types';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import ImageUpload from '@/components/ImageUpload';
import { ArrowRight, GraduationCap, Plus, Edit, Trash2, Eye, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrainingFilePage() {
  const { id: fileId } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [trainingFile, setTrainingFile] = useState<TrainingFile | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TrainingSession | null>(null);
  const [selected, setSelected] = useState<TrainingSession | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    centerName: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    report: '',
    images: [] as string[],
  });

  useEffect(() => {
    if (!fileId || !profile?.uid) return;
    fetchData();
  }, [fileId, profile]);

  async function fetchData() {
    try {
      const fileDoc = await getDoc(doc(db, 'trainingFiles', fileId));
      if (fileDoc.exists()) {
        setTrainingFile({ id: fileDoc.id, ...fileDoc.data() } as TrainingFile);
      }

      const snap = await getDocs(query(collection(db, 'trainingSessions'), where('trainingFileId', '==', fileId)));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TrainingSession[];
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const openCreate = () => {
    setEditing(null);
    setForm({ centerName: '', title: '', date: new Date().toISOString().split('T')[0], report: '', images: [] });
    setShowModal(true);
  };

  const openEdit = (s: TrainingSession) => {
    setEditing(s);
    setForm({ centerName: s.centerName, title: s.title, date: s.date, report: s.report, images: s.images || [] });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('العنوان مطلوب'); return; }
    if (!form.centerName.trim()) { toast.error('اسم المركز مطلوب'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editing) {
        await updateDoc(doc(db, 'trainingSessions', editing.id), {
          centerName: form.centerName.trim(),
          title: form.title.trim(),
          date: form.date,
          report: form.report,
          images: form.images,
          updatedAt: now,
        });
        toast.success('تم التحديث');
      } else {
        await addDoc(collection(db, 'trainingSessions'), {
          trainingFileId: fileId,
          trainerId: profile!.uid,
          trainerName: profile!.name,
          centerName: form.centerName.trim(),
          title: form.title.trim(),
          date: form.date,
          report: form.report,
          images: form.images,
          createdAt: now,
          updatedAt: now,
          createdBy: profile!.uid,
        });

        // Update sessions count
        if (trainingFile) {
          await updateDoc(doc(db, 'trainingFiles', fileId), {
            sessionsCount: sessions.length + 1,
            updatedAt: now,
          });
        }
        toast.success('تم إضافة الجلسة');
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: TrainingSession) => {
    if (!confirm('حذف هذه الجلسة؟')) return;
    try {
      await deleteDoc(doc(db, 'trainingSessions', s.id));
      // Update sessions count
      if (trainingFile) {
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'trainingFiles', fileId), {
          sessionsCount: Math.max(0, sessions.length - 1),
          updatedAt: now,
        });
      }
      toast.success('تم الحذف');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('خطأ');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!trainingFile) {
    return (
      <div className="text-center py-12">
        <GraduationCap size={48} className="text-slate-300 mx-auto mb-4" />
        <p className="text-slate-400">الملف التدريبي غير موجود</p>
        <Button variant="secondary" onClick={() => router.push('/trainer/programs')} className="mt-4">
          العودة للملفات
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-xl">
            <FolderOpen size={24} className="text-purple-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-purple-800">{trainingFile.title}</h1>
            {trainingFile.description && (
              <p className="text-xs text-purple-600 mt-0.5">{trainingFile.description}</p>
            )}
            <p className="text-xs text-purple-500 mt-0.5">{sessions.length} جلسة تدريبية</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => router.push('/trainer/programs')} icon={<ArrowRight size={16} />}>
          العودة
        </Button>
      </div>

      {/* Add Session Button */}
      <div className="flex justify-end">
        <Button onClick={openCreate} icon={<Plus size={18} />}>
          إضافة جلسة
        </Button>
      </div>

      {/* Sessions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow animate-fade-in">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-xl">
                  <GraduationCap size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{s.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{s.centerName}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-3">{s.date}</p>
            {s.report && <p className="text-sm text-slate-600 line-clamp-2 mb-3">{s.report}</p>}
            {s.images && s.images.length > 0 && (
              <div className="flex gap-1 mb-3">
                {s.images.slice(0, 3).map((url, i) => (
                  <img key={i} src={url} alt="" className="w-12 h-12 rounded-lg object-cover" loading="lazy" />
                ))}
                {s.images.length > 3 && <span className="text-xs text-slate-400 flex items-center">+{s.images.length - 3}</span>}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setSelected(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Eye size={16} /></button>
              <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Edit size={16} /></button>
              <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">لا توجد جلسات في هذا الملف</p>
          <p className="text-xs text-slate-300 mt-1">أضف جلسة تدريبية جديدة</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل جلسة' : 'إضافة جلسة جديدة'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">عنوان الجلسة *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">اسم المركز *</label>
            <input type="text" value={form.centerName} onChange={(e) => setForm({ ...form, centerName: e.target.value })}
              placeholder="أدخل اسم المركز"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">التاريخ</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">التقرير</label>
            <textarea value={form.report} onChange={(e) => setForm({ ...form, report: e.target.value })}
              rows={4} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الصور (اختياري)</label>
            <ImageUpload images={form.images} onChange={(images) => setForm({ ...form, images })} />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} loading={saving}>{editing ? 'تحديث' : 'إضافة'}</Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.title || ''} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-400">المركز</p><p className="font-medium">{selected.centerName}</p></div>
              <div><p className="text-xs text-slate-400">التاريخ</p><p className="font-medium">{selected.date}</p></div>
            </div>
            {selected.report && <div><p className="text-xs text-slate-400 mb-1">التقرير</p><p className="text-sm bg-slate-50 p-3 rounded-xl">{selected.report}</p></div>}
            {selected.images && selected.images.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">الصور</p>
                <div className="flex flex-wrap gap-2">{selected.images.map((url, i) => <img key={i} src={url} alt="" className="w-32 h-32 rounded-xl object-cover" loading="lazy" />)}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

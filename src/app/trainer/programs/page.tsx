'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { TrainingFile } from '@/lib/types';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import SearchFilter from '@/components/SearchFilter';
import { GraduationCap, Plus, Edit, Trash2, FolderOpen, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function TrainerProgramsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<TrainingFile[]>([]);
  const [filtered, setFiltered] = useState<TrainingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TrainingFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });

  useEffect(() => {
    if (!profile?.uid) return;
    fetchFiles();
  }, [profile]);

  async function fetchFiles() {
    try {
      const snap = await getDocs(query(collection(db, 'trainingFiles'), where('trainerId', '==', profile!.uid)));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TrainingFile[];
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFiles(data);
      setFiltered(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (term: string) => {
    if (!term) { setFiltered(files); return; }
    const lower = term.toLowerCase();
    setFiltered(files.filter((f) => f.title.toLowerCase().includes(lower) || f.description?.toLowerCase().includes(lower)));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (f: TrainingFile) => {
    setEditing(f);
    setForm({ title: f.title, description: f.description || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('العنوان مطلوب'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editing) {
        await updateDoc(doc(db, 'trainingFiles', editing.id), {
          title: form.title.trim(),
          description: form.description.trim(),
          updatedAt: now,
        });
        toast.success('تم التحديث');
      } else {
        await addDoc(collection(db, 'trainingFiles'), {
          trainerId: profile!.uid,
          trainerName: profile!.name,
          title: form.title.trim(),
          description: form.description.trim(),
          sessionsCount: 0,
          createdAt: now,
          updatedAt: now,
          createdBy: profile!.uid,
        });
        toast.success('تم إنشاء الملف التدريبي');
      }
      setShowModal(false);
      fetchFiles();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: TrainingFile) => {
    if (!confirm(`حذف الملف التدريبي "${f.title}"؟ سيتم حذف جميع الجلسات بداخله.`)) return;
    try {
      // Delete all sessions inside this file
      const sessionsSnap = await getDocs(query(collection(db, 'trainingSessions'), where('trainingFileId', '==', f.id)));
      const deletePromises = sessionsSnap.docs.map((d) => deleteDoc(doc(db, 'trainingSessions', d.id)));
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, 'trainingFiles', f.id));
      toast.success('تم الحذف');
      fetchFiles();
    } catch (error) {
      console.error(error);
      toast.error('خطأ في الحذف');
    }
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
          <h1 className="text-2xl font-bold text-slate-800">الملفات التدريبية</h1>
          <p className="text-slate-500 mt-1">إدارة البرامج والملفات التدريبية</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={18} />}>
          ملف تدريبي جديد
        </Button>
      </div>

      <SearchFilter searchPlaceholder="بحث بالعنوان أو الوصف..." onSearch={handleSearch} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((f) => (
          <div
            key={f.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow animate-fade-in cursor-pointer group"
            onClick={() => router.push(`/trainer/programs/${f.id}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                  <FolderOpen size={22} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{f.title}</h3>
                  {f.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{f.description}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1">
                <FileText size={12} />
                {f.sessionsCount} جلسة
              </span>
              <span className="text-xs text-slate-400">
                {new Date(f.createdAt).toLocaleDateString('ar-LB')}
              </span>
            </div>

            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => openEdit(f)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDelete(f)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">لا توجد ملفات تدريبية</p>
          <p className="text-xs text-slate-300 mt-1">أنشئ ملفاً تدريبياً جديداً لبدء إضافة الجلسات</p>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل ملف تدريبي' : 'ملف تدريبي جديد'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">عنوان الملف التدريبي *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="مثال: دورة الإسعافات الأولية"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">الوصف</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="وصف مختصر للبرنامج التدريبي"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} loading={saving}>{editing ? 'تحديث' : 'إنشاء'}</Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

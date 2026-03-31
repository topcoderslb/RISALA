'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs, invalidateCachePrefix } from '@/lib/firebase-cache';
import { TrainingFile, TrainingSession } from '@/lib/types';
import SearchFilter from '@/components/SearchFilter';
import Modal from '@/components/Modal';
import { GraduationCap, Trash2, Eye, FolderOpen, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface FileWithSessions extends TrainingFile {
  sessions: TrainingSession[];
}

export default function AdminTrainingPage() {
  const [files, setFiles] = useState<FileWithSessions[]>([]);
  const [filtered, setFiltered] = useState<FileWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrainingSession | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    invalidateCachePrefix('trainingFiles');
    invalidateCachePrefix('trainingSessions');
    try {
      const [filesSnap, sessionsSnap] = await Promise.all([
        cachedGetDocs(collection(db, 'trainingFiles'), 'trainingFiles'),
        cachedGetDocs(collection(db, 'trainingSessions'), 'trainingSessions'),
      ]);

      const allFiles = filesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TrainingFile[];
      const allSessions = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TrainingSession[];

      const filesWithSessions: FileWithSessions[] = allFiles.map((f) => ({
        ...f,
        sessions: allSessions
          .filter((s) => s.trainingFileId === f.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }));

      // Also include sessions without a trainingFileId (legacy data)
      const orphanSessions = allSessions.filter((s) => !s.trainingFileId);
      if (orphanSessions.length > 0) {
        filesWithSessions.push({
          id: '__orphan__',
          trainerId: '',
          trainerName: '',
          title: 'جلسات بدون ملف تدريبي',
          description: 'جلسات تدريبية قديمة',
          sessionsCount: orphanSessions.length,
          createdAt: '',
          updatedAt: '',
          createdBy: '',
          sessions: orphanSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        });
      }

      filesWithSessions.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setFiles(filesWithSessions);
      setFiltered(filesWithSessions);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (term: string) => {
    if (!term) { setFiltered(files); return; }
    const lower = term.toLowerCase();
    setFiltered(files.filter((f) =>
      f.title.toLowerCase().includes(lower) ||
      f.trainerName.toLowerCase().includes(lower) ||
      f.sessions.some((s) =>
        s.title.toLowerCase().includes(lower) ||
        s.centerName.toLowerCase().includes(lower) ||
        s.trainerName.toLowerCase().includes(lower)
      )
    ));
  };

  const toggleExpand = (fileId: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const handleDeleteSession = async (session: TrainingSession) => {
    if (!confirm('حذف هذا التدريب؟')) return;
    try {
      await deleteDoc(doc(db, 'trainingSessions', session.id));
      toast.success('تم الحذف');
      fetchData();
    } catch { toast.error('خطأ'); }
  };

  const handleDeleteFile = async (file: FileWithSessions) => {
    if (file.id === '__orphan__') return;
    if (!confirm(`حذف الملف التدريبي "${file.title}" وجميع جلساته؟`)) return;
    try {
      const deletePromises = file.sessions.map((s) => deleteDoc(doc(db, 'trainingSessions', s.id)));
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, 'trainingFiles', file.id));
      toast.success('تم الحذف');
      fetchData();
    } catch { toast.error('خطأ'); }
  };

  const totalSessions = files.reduce((acc, f) => acc + f.sessions.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">التدريبات</h1>
        <p className="text-slate-500 mt-1">{files.length} ملف تدريبي - {totalSessions} جلسة</p>
      </div>

      <SearchFilter
        searchPlaceholder="بحث بالعنوان أو اسم المركز أو المدرب..."
        onSearch={handleSearch}
      />

      <div className="space-y-4">
        {filtered.map((file) => (
          <div key={file.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
            {/* File Header */}
            <div
              className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
              onClick={() => toggleExpand(file.id)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-xl">
                  <FolderOpen size={20} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{file.title}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    {file.trainerName && (
                      <span className="text-xs text-slate-400">المدرب: {file.trainerName}</span>
                    )}
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {file.sessions.length} جلسة
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {file.id !== '__orphan__' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {expandedFiles.has(file.id) ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
              </div>
            </div>

            {/* Sessions Table */}
            {expandedFiles.has(file.id) && file.sessions.length > 0 && (
              <div className="border-t border-slate-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">العنوان</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">المدرب</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">المركز</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">التاريخ</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {file.sessions.map((s) => (
                      <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50/30">
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{s.title}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{s.trainerName}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">{s.centerName}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-500">{s.date}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelected(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Eye size={16} /></button>
                            <button onClick={() => handleDeleteSession(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expandedFiles.has(file.id) && file.sessions.length === 0 && (
              <div className="border-t border-slate-100 text-center py-6">
                <p className="text-sm text-slate-400">لا توجد جلسات في هذا الملف</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">لا توجد تدريبات</p>
        </div>
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.title || ''} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">المدرب</p>
                <p className="font-medium">{selected.trainerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">المركز</p>
                <p className="font-medium">{selected.centerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">التاريخ</p>
                <p className="font-medium">{selected.date}</p>
              </div>
            </div>
            {selected.report && (
              <div>
                <p className="text-xs text-slate-400 mb-1">التقرير</p>
                <p className="text-sm bg-slate-50 p-3 rounded-xl">{selected.report}</p>
              </div>
            )}
            {selected.images && selected.images.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">الصور</p>
                <div className="flex flex-wrap gap-2">
                  {selected.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover" loading="lazy" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

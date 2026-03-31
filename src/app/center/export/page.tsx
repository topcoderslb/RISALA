'use client';

import { useState } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { Operation, Medic, Center } from '@/lib/types';
import Button from '@/components/Button';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportToJSON, exportCenterDataToCSV } from '@/lib/export-utils';
import toast from 'react-hot-toast';

export default function CenterExportPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: 'json' | 'csv') => {
    if (!profile?.centerId) return;
    setLoading(true);
    try {
      const cid = profile.centerId!;
      const [opsSnap, medicsSnap, schedSnap, centerDoc] = await Promise.all([
        cachedGetDocs(query(collection(db, 'operations'), where('centerId', '==', cid)), `operations:${cid}`),
        cachedGetDocs(query(collection(db, 'medics'), where('centerId', '==', cid)), `medics:${cid}`),
        cachedGetDocs(query(collection(db, 'schedules'), where('centerId', '==', cid)), `schedules:${cid}`),
        getDoc(doc(db, 'centers', cid)),
      ]);

      const operations = opsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Operation[];
      const medics = medicsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Medic[];
      const schedules = schedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const center = centerDoc.exists() ? { id: centerDoc.id, ...centerDoc.data() } as Center : null;

      if (format === 'json') {
        exportToJSON({ center, operations, medics, schedules }, `center-${profile.centerName}`);
      } else if (center) {
        exportCenterDataToCSV(center, operations, medics);
      }

      toast.success('تم التصدير بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">تصدير البيانات</h1>
        <p className="text-slate-500 mt-1">تصدير بيانات المركز</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Download size={32} className="text-primary-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">تصدير بيانات المركز</h2>
        <p className="text-slate-500 mb-6">تصدير جميع الحالات، المسعفين، والجداول</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => handleExport('json')} loading={loading} icon={<FileJson size={18} />}>
            تصدير JSON
          </Button>
          <Button onClick={() => handleExport('csv')} loading={loading} variant="secondary" icon={<FileSpreadsheet size={18} />}>
            تصدير CSV
          </Button>
        </div>
      </div>
    </div>
  );
}

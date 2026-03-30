'use client';

import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Button from '@/components/Button';
import { Download, Database, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportToJSON, exportToCSV } from '@/lib/export-utils';
import toast from 'react-hot-toast';

export default function AdminBackupPage() {
  const [loading, setLoading] = useState(false);

  const exportAll = async (format: 'json' | 'csv') => {
    setLoading(true);
    try {
      const collections = ['centers', 'operations', 'medics', 'schedules', 'trainingSessions', 'users'];
      const allData: Record<string, unknown[]> = {};

      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        allData[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      if (format === 'json') {
        exportToJSON(allData, 'risala-backup-full');
      } else {
        for (const [name, data] of Object.entries(allData)) {
          if (data.length > 0) {
            exportToCSV(data as Record<string, unknown>[], `risala-${name}`);
          }
        }
      }

      toast.success('تم التصدير بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setLoading(false);
    }
  };

  const exportCollection = async (collectionName: string, label: string) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, collectionName));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      exportToJSON(data, `risala-${collectionName}`);
      toast.success(`تم تصدير ${label}`);
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
        <h1 className="text-2xl font-bold text-slate-800">التصدير والنسخ الاحتياطي</h1>
        <p className="text-slate-500 mt-1">تصدير ونسخ احتياطي لبيانات النظام</p>
      </div>

      {/* Full Export */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary-50 rounded-xl">
            <Database size={24} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">تصدير كامل</h2>
            <p className="text-sm text-slate-500">تصدير جميع بيانات النظام</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => exportAll('json')}
            loading={loading}
            icon={<FileJson size={18} />}
          >
            تصدير JSON
          </Button>
          <Button
            onClick={() => exportAll('csv')}
            loading={loading}
            icon={<FileSpreadsheet size={18} />}
            variant="secondary"
          >
            تصدير CSV
          </Button>
        </div>
      </div>

      {/* Individual Collections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { key: 'centers', label: 'المراكز', icon: '🏢' },
          { key: 'operations', label: 'الحالات', icon: '🚑' },
          { key: 'medics', label: 'المسعفين', icon: '👥' },
          { key: 'schedules', label: 'الجداول', icon: '📅' },
          { key: 'trainingSessions', label: 'التدريبات', icon: '🎓' },
          { key: 'users', label: 'المستخدمين', icon: '🔐' },
        ].map((item) => (
          <div key={item.key} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="font-medium text-slate-700">{item.label}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportCollection(item.key, item.label)}
                loading={loading}
                icon={<Download size={14} />}
              >
                تصدير
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

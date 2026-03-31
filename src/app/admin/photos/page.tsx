'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { ImageIcon, RefreshCw, X, Filter, Download } from 'lucide-react';

interface PhotoEntry {
  url: string;
  source: string;
  sourceLabel: string;
  centerName: string;
  date: string;
  details: string;
}

const SOURCE_LABELS: Record<string, string> = {
  operations: 'الحالات',
  centerDamageEvents: 'أضرار المراكز',
  vehicleDamageEvents: 'أضرار السيارات',
};

export default function AdminPhotosPage() {
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [filterCenter, setFilterCenter] = useState('');
  const [filterSource, setFilterSource] = useState('');

  async function downloadPhoto(url: string, name: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name || 'photo.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  }

  useEffect(() => {
    if (profile?.role === 'superadmin') fetchPhotos();
  }, [profile]);

  async function fetchPhotos() {
    setLoading(true);
    try {
      const allPhotos: PhotoEntry[] = [];

      // Operations
      const opsSnap = await cachedGetDocs(collection(db, 'operations'), 'operations');
      opsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.images?.length) {
          data.images.forEach((url: string) => {
            allPhotos.push({
              url,
              source: 'operations',
              sourceLabel: SOURCE_LABELS.operations,
              centerName: data.centerName || 'غير محدد',
              date: data.createdAt || '',
              details: `حالة ${data.type || ''} - ${data.caseNumber || ''}`,
            });
          });
        }
      });

      // Center Damage Events
      const cdSnap = await cachedGetDocs(collection(db, 'centerDamageEvents'), 'centerDamageEvents');
      cdSnap.docs.forEach(d => {
        const data = d.data();
        if (data.images?.length) {
          data.images.forEach((url: string) => {
            allPhotos.push({
              url,
              source: 'centerDamageEvents',
              sourceLabel: SOURCE_LABELS.centerDamageEvents,
              centerName: data.centerName || 'غير محدد',
              date: data.attackDate || data.createdAt || '',
              details: `أضرار مركز - ${data.attackDate || ''}`,
            });
          });
        }
      });

      // Vehicle Damage Events
      const vdSnap = await cachedGetDocs(collection(db, 'vehicleDamageEvents'), 'vehicleDamageEvents');
      vdSnap.docs.forEach(d => {
        const data = d.data();
        if (data.images?.length) {
          data.images.forEach((url: string) => {
            allPhotos.push({
              url,
              source: 'vehicleDamageEvents',
              sourceLabel: SOURCE_LABELS.vehicleDamageEvents,
              centerName: data.centerName || 'غير محدد',
              date: data.incidentDate || data.createdAt || '',
              details: `أضرار سيارة ${data.vehicleNumber || ''} - ${data.incidentDate || ''}`,
            });
          });
        }
      });

      allPhotos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setPhotos(allPhotos);
    } catch (e) {
      console.error('Error fetching photos:', e);
    } finally {
      setLoading(false);
    }
  }

  const centers = photos.reduce<string[]>((acc, p) => {
    if (!acc.includes(p.centerName)) acc.push(p.centerName);
    return acc;
  }, []);

  const filteredPhotos = photos.filter(p => {
    if (filterCenter && p.centerName !== filterCenter) return false;
    if (filterSource && p.source !== filterSource) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <ImageIcon size={24} className="text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">الصور</h1>
            <p className="text-sm text-gray-500">جميع الصور المرفقة من جميع المراكز</p>
          </div>
        </div>
        <button onClick={fetchPhotos} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
          <RefreshCw size={16} />
          تحديث
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">تصفية</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={filterCenter}
            onChange={e => setFilterCenter(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="">كل المراكز</option>
            {centers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="">كل الأقسام</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <p className="text-sm text-gray-500">{filteredPhotos.length} صورة</p>

      {filteredPhotos.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg">لا توجد صور</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredPhotos.map((photo, i) => (
            <div key={i} className="bg-white rounded-xl border overflow-hidden group hover:shadow-lg transition">
              <div className="relative aspect-square cursor-pointer" onClick={() => setSelectedPhoto(photo.url)}>
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{photo.centerName}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadPhoto(photo.url, `photo-${i + 1}.jpg`); }}
                    className="p-1 text-gray-400 hover:text-green-600 transition"
                    title="تنزيل"
                  >
                    <Download size={14} />
                  </button>
                </div>
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                  {photo.sourceLabel}
                </span>
                <p className="text-xs text-gray-500 truncate mt-1">{photo.details}</p>
                {photo.date && <p className="text-xs text-gray-400 mt-1">{photo.date}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <button className="absolute top-4 left-4 text-white hover:text-gray-300" onClick={() => setSelectedPhoto(null)}>
            <X size={32} />
          </button>
          <button
            className="absolute top-4 left-16 text-white hover:text-gray-300 flex items-center gap-1"
            onClick={(e) => { e.stopPropagation(); downloadPhoto(selectedPhoto, 'photo.jpg'); }}
          >
            <Download size={24} />
          </button>
          <img src={selectedPhoto} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

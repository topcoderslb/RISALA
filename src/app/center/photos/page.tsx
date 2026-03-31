'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cachedGetDocs } from '@/lib/firebase-cache';
import { useAuth } from '@/lib/auth-context';
import { ImageIcon, ExternalLink, RefreshCw, X, Download } from 'lucide-react';

interface PhotoEntry {
  url: string;
  source: string;
  sourceLabel: string;
  date: string;
  details: string;
}

const SOURCE_LABELS: Record<string, string> = {
  operations: 'الحالات',
  centerDamageEvents: 'أضرار المراكز',
  vehicleDamageEvents: 'أضرار السيارات',
};

export default function CenterPhotosPage() {
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

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
    if (profile?.centerId) fetchPhotos();
  }, [profile]);

  async function fetchPhotos() {
    setLoading(true);
    try {
      const allPhotos: PhotoEntry[] = [];

      const cid = profile!.centerId!;

      // Operations
      const opsSnap = await cachedGetDocs(query(collection(db, 'operations'), where('centerId', '==', cid)), `operations:${cid}`);
      opsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.images?.length) {
          data.images.forEach((url: string) => {
            allPhotos.push({
              url,
              source: 'operations',
              sourceLabel: SOURCE_LABELS.operations,
              date: data.createdAt || '',
              details: `حالة ${data.type || ''} - ${data.caseNumber || ''}`,
            });
          });
        }
      });

      // Center Damage Events
      const cdSnap = await cachedGetDocs(query(collection(db, 'centerDamageEvents'), where('centerId', '==', cid)), `centerDamageEvents:${cid}`);
      cdSnap.docs.forEach(d => {
        const data = d.data();
        if (data.images?.length) {
          data.images.forEach((url: string) => {
            allPhotos.push({
              url,
              source: 'centerDamageEvents',
              sourceLabel: SOURCE_LABELS.centerDamageEvents,
              date: data.attackDate || data.createdAt || '',
              details: `أضرار مركز - ${data.attackDate || ''}`,
            });
          });
        }
      });

      // Vehicle Damage Events
      const vdSnap = await cachedGetDocs(query(collection(db, 'vehicleDamageEvents'), where('centerId', '==', cid)), `vehicleDamageEvents:${cid}`);
      vdSnap.docs.forEach(d => {
        const data = d.data();
        if (data.images?.length) {
          data.images.forEach((url: string) => {
            allPhotos.push({
              url,
              source: 'vehicleDamageEvents',
              sourceLabel: SOURCE_LABELS.vehicleDamageEvents,
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
            <p className="text-sm text-gray-500">جميع الصور المرفقة بسجلات المركز</p>
          </div>
        </div>
        <button onClick={fetchPhotos} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
          <RefreshCw size={16} />
          تحديث
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg">لا توجد صور</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo, i) => (
            <div key={i} className="bg-white rounded-xl border overflow-hidden group hover:shadow-lg transition">
              <div className="relative aspect-square cursor-pointer" onClick={() => setSelectedPhoto(photo.url)}>
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {photo.sourceLabel}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadPhoto(photo.url, `photo-${i + 1}.jpg`); }}
                    className="p-1 text-gray-400 hover:text-green-600 transition"
                    title="تنزيل"
                  >
                    <Download size={14} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 truncate">{photo.details}</p>
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

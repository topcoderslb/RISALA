'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Dismissed previously
    if (localStorage.getItem('pwa-dismissed') === '1') {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!prompt) return;
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') {
      setPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-dismissed', '1');
  };

  if (isInstalled || dismissed) return null;
  if (!prompt && !isIOS) return null;

  return (
    <>
      {/* Install banner */}
      <div className="fixed bottom-4 right-4 left-4 z-50 md:left-auto md:w-80">
        <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Download size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm">ثبّت التطبيق</p>
            <p className="text-xs text-slate-500 mt-0.5">اضغط لتثبيت المنصة على هاتفك واستخدامها بدون متصفح</p>
            <button
              onClick={handleInstall}
              className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-2 rounded-xl transition-colors"
            >
              تثبيت الآن
            </button>
          </div>
          <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 shrink-0 -mt-1">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* iOS instructions modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-3">
            <h3 className="font-bold text-slate-800 text-center">تثبيت على iPhone / iPad</h3>
            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2"><span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-xs flex items-center justify-center shrink-0 mt-0.5">١</span>اضغط على زر المشاركة ﹀ في شريط Safari</li>
              <li className="flex items-start gap-2"><span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-xs flex items-center justify-center shrink-0 mt-0.5">٢</span>اختر "إضافة إلى الشاشة الرئيسية"</li>
              <li className="flex items-start gap-2"><span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-xs flex items-center justify-center shrink-0 mt-0.5">٣</span>اضغط "إضافة" للتأكيد</li>
            </ol>
            <button
              onClick={() => { setShowIOSGuide(false); handleDismiss(); }}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium"
            >
              تم
            </button>
          </div>
        </div>
      )}
    </>
  );
}

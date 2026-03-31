'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Building2,
  Users,
  Ambulance,
  Calendar,
  GraduationCap,
  BookOpen,
  BarChart3,
  Download,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  AlertTriangle,
  Info,
  Shield,
  ImageIcon,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export default function Sidebar() {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  if (!profile) return null;

  const getNavItems = (): NavItem[] => {
    if (profile.role === 'superadmin') {
      return [
        { label: 'لوحة التحكم', href: '/admin', icon: <LayoutDashboard size={20} /> },
        { label: 'المراكز', href: '/admin/centers', icon: <Building2 size={20} /> },
        { label: 'الحالات', href: '/admin/operations', icon: <Ambulance size={20} /> },
        { label: 'المسعفين', href: '/admin/medics', icon: <Users size={20} /> },
        { label: 'المدربون', href: '/admin/trainers', icon: <GraduationCap size={20} /> },
        { label: 'التدريب', href: '/admin/training', icon: <BookOpen size={20} /> },
        { label: 'أحداث المنطقة', href: '/admin/events', icon: <AlertTriangle size={20} /> },
        { label: 'معلومات المراكز', href: '/admin/center-info', icon: <Info size={20} /> },
        { label: 'التقارير', href: '/admin/reports', icon: <BarChart3 size={20} /> },
        { label: 'المراقبة', href: '/admin/monitoring', icon: <Shield size={20} /> },
        { label: 'الصور', href: '/admin/photos', icon: <ImageIcon size={20} /> },
        { label: 'التصدير والنسخ', href: '/admin/backup', icon: <Download size={20} /> },
      ];
    }

    if (profile.role === 'center_leader') {
      return [
        { label: 'لوحة التحكم', href: '/center', icon: <LayoutDashboard size={20} /> },
        { label: 'الحالات', href: '/center/operations', icon: <Ambulance size={20} /> },
        { label: 'المسعفين', href: '/center/medics', icon: <Users size={20} /> },
        { label: 'الجداول', href: '/center/schedules', icon: <Calendar size={20} /> },
        { label: 'أحداث المركز', href: '/center/events', icon: <AlertTriangle size={20} /> },
        { label: 'معلومات المركز', href: '/center/info', icon: <Info size={20} /> },
        { label: 'التقارير', href: '/center/reports', icon: <BarChart3 size={20} /> },
        { label: 'الصور', href: '/center/photos', icon: <ImageIcon size={20} /> },
        { label: 'التصدير', href: '/center/export', icon: <Download size={20} /> },
      ];
    }

    if (profile.role === 'trainer') {
      return [
        { label: 'لوحة التحكم', href: '/trainer', icon: <LayoutDashboard size={20} /> },
        { label: 'الملفات التدريبية', href: '/trainer/programs', icon: <GraduationCap size={20} /> },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const roleLabels: Record<string, string> = {
    superadmin: 'قائد المنطقة',
    center_leader: 'قائد مركز',
    trainer: 'مدرب',
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 bg-primary-700 text-white p-2 rounded-lg shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-72 bg-gradient-to-b from-primary-900 via-primary-800 to-primary-950 text-white z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-primary-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md overflow-hidden">
              <Image src="/risala.png" alt="شعار الرسالة" width={40} height={40} className="object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold">جمعية الرسالة</h1>
              <p className="text-xs text-emerald-300">للإسعاف الصحي - المنطقة الثانية</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 mx-3 mt-3 bg-white/5 rounded-xl">
          <p className="font-semibold text-sm">{profile.name}</p>
          <p className="text-xs text-emerald-300 mt-1">{roleLabels[profile.role]}</p>
          {profile.centerName && (
            <p className="text-xs text-emerald-200 mt-1">{profile.centerName}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-3 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/15 text-white shadow-lg'
                        : 'text-emerald-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {isActive && <ChevronLeft size={16} className="mr-auto" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-primary-700/50 space-y-1">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all w-full"
          >
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}

'use client';

import { useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const NOTIFICATION_KEY = 'lastDailyReminder';

export function useDailyReminder(isEnabled: boolean) {
  const hasChecked = useRef(false);

  const checkAndNotify = useCallback(() => {
    if (!isEnabled || hasChecked.current) return;
    hasChecked.current = true;

    const lastReminder = localStorage.getItem(NOTIFICATION_KEY);
    const today = new Date().toDateString();

    if (lastReminder !== today) {
      localStorage.setItem(NOTIFICATION_KEY, today);
      
      // Check if it's working hours (8 AM - 10 PM)
      const hour = new Date().getHours();
      if (hour >= 8 && hour <= 22) {
        toast('📋 تذكير: لا تنسَ إدخال بيانات اليوم (العمليات والتقارير)', {
          duration: 8000,
          style: {
            background: '#166534',
            color: '#fff',
            padding: '16px',
            borderRadius: '12px',
            fontSize: '14px',
          },
          icon: '🔔',
        });
      }
    }
  }, [isEnabled]);

  useEffect(() => {
    checkAndNotify();
  }, [checkAndNotify]);
}

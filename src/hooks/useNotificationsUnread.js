// src/hooks/useNotificationsUnread.js
//
// Returns the unread notification count for the current organization.
// Refetches when the Alerts tab regains focus and on the given interval
// (default 60s), so the badge stays reasonably current without a real
// push channel yet.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useOrganizationContext } from '../context/OrganizationContext';
import notificationsService from '../services/notifications.service';

const DEFAULT_INTERVAL = 60000;

export function useNotificationsUnread({ intervalMs = DEFAULT_INTERVAL } = {}) {
  const { activeOrganization } = useOrganizationContext();
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!activeOrganization?.id) {
      setCount(0);
      return;
    }
    try {
      const c = await notificationsService.unreadCount(activeOrganization.id);
      if (mountedRef.current) setCount(c);
    } catch {
      // silent: badge is best-effort
    }
  }, [activeOrganization?.id]);

  // Refetch when any screen comes into focus (cheap, catches most cases)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Also poll at a slow interval so a fresh notification arrives eventually
  useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return count;
}

export default useNotificationsUnread;
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';

export function readOnlyMessage(status, phaseEndsAt) {
  switch (status) {
    case 'GRACE': {
      const d = phaseEndsAt ? new Date(phaseEndsAt).toLocaleDateString() : null;
      return `Your subscription has lapsed. The app is read-only until you renew on the web${d ? ` (before ${d})` : ''}.`;
    }
    case 'EXPIRED':
      return 'Your subscription has expired. Renew on the web to make changes.';
    case 'SUSPENDED':
      return 'Your subscription is suspended. Contact KxByte to restore access.';
    case 'CANCELLED':
      return 'Your subscription was cancelled. Reactivate it on the web.';
    default:
      return 'This action is not available right now.';
  }
}

// While the status is still UNKNOWN (first load, nothing cached),
// canWrite is true, so a slow network never blocks a paying customer.
// The server remains the real authority.
export default function useWriteAccess() {
  const { canWrite, status, phaseEndsAt, refresh } = useSubscription();
  const message = readOnlyMessage(status, phaseEndsAt);

  const notify = useCallback(
    () => Alert.alert('Read-only', message),
    [message]
  );

  // Wrap a handler so it only runs when writes are allowed.
  const guard = useCallback(
    (fn) =>
      (...args) => {
        if (canWrite) return fn?.(...args);
        notify();
        return undefined;
      },
    [canWrite, notify]
  );

  return { canWrite, status, message, notify, guard, refresh };
}
import { useSubscription } from '../context/SubscriptionContext';
import ReadOnlyNotice from '../components/subscription/ReadOnlyNotice';

// Wrap a write-only screen ONCE at module level, never inside a render:
//   const GatedPOS = withWriteGate(POSScreen, { title: 'POS' });
export default function withWriteGate(Screen, { title } = {}) {
  function Gated(props) {
    const { canWrite } = useSubscription();
    if (!canWrite) return <ReadOnlyNotice title={title} />;
    return <Screen {...props} />;
  }
  Gated.displayName = `WriteGate(${Screen.displayName || Screen.name || 'Screen'})`;
  return Gated;
}
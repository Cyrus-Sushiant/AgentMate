import { HealthBoard } from '@/components/health/HealthBoard';
import { usePageHeader } from '@/stores/pageHeaderStore';

/** Project health checks (E22): every project's watched endpoints in one place. */
export default function HealthPage(): React.JSX.Element {
  usePageHeader(
    'Monitoring',
    'Watch each environment’s health endpoint and see what broke, and why.',
  );
  return (
    <div className="p-2">
      <HealthBoard />
    </div>
  );
}

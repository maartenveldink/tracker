import { PageHeader } from '../../../components/PageHeader';
import { WorkoutHistory } from '../components/WorkoutHistory';

export function WorkoutHistoryPage() {
  return (
    <div>
      <PageHeader title="Trainingshistorie" backTo="/start" />
      <WorkoutHistory />
    </div>
  );
}

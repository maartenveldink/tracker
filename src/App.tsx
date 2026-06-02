import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ExercisesPage } from './pages/ExercisesPage';
import { ExerciseFormPage } from './pages/ExerciseFormPage';
import { SchemasPage } from './pages/SchemasPage';
import { SchemaFormPage } from './pages/SchemaFormPage';
import { SchemaDetailPage } from './pages/SchemaDetailPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { WorkoutSummaryPage } from './pages/WorkoutSummaryPage';
import { StartWorkoutPage } from './pages/StartWorkoutPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <Routes>
      {/* Workout pages have their own minimal layout */}
      <Route path="/workout/:id" element={<WorkoutPage />} />
      <Route path="/workout/:id/summary" element={<WorkoutSummaryPage />} />

      {/* Standard pages with nav layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/exercises" replace />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/exercises/new" element={<ExerciseFormPage />} />
        <Route path="/exercises/:id/edit" element={<ExerciseFormPage />} />
        <Route path="/schemas" element={<SchemasPage />} />
        <Route path="/schemas/new" element={<SchemaFormPage />} />
        <Route path="/schemas/:id" element={<SchemaDetailPage />} />
        <Route path="/schemas/:id/edit" element={<SchemaFormPage />} />
        <Route path="/start" element={<StartWorkoutPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/exercises" replace />} />
      </Route>
    </Routes>
  );
}

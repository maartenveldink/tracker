import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ReloadPrompt } from './components/ReloadPrompt';
import { SchemaImportHandler } from './components/SchemaImportHandler';

// Core training pages — eager, this is the main flow
import { ExercisesPage } from './features/training/pages/ExercisesPage';
import { ExerciseFormPage } from './features/training/pages/ExerciseFormPage';
import { SchemasPage } from './features/training/pages/SchemasPage';
import { SchemaFormPage } from './features/training/pages/SchemaFormPage';
import { SchemaDetailPage } from './features/training/pages/SchemaDetailPage';
import { WorkoutPage } from './features/training/pages/WorkoutPage';
import { WorkoutEditPage } from './features/training/pages/WorkoutEditPage';
import { WorkoutSummaryPage } from './features/training/pages/WorkoutSummaryPage';
import { StartWorkoutPage } from './features/training/pages/StartWorkoutPage';
import { SuggestWorkoutPage } from './features/training/pages/SuggestWorkoutPage';
import { WorkoutHistoryPage } from './features/training/pages/WorkoutHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';

// Progress is lazy-loaded so recharts stays out of the initial bundle.
const ProgressPage = lazy(() => import('./features/training/pages/ProgressPage').then(m => ({ default: m.ProgressPage })));

export function App() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Routes>
        {/* Workout pages have their own minimal layout */}
        <Route path="/workout/:id" element={<WorkoutPage />} />
        <Route path="/workout/:id/edit" element={<WorkoutEditPage />} />
        <Route path="/workout/:id/summary" element={<WorkoutSummaryPage />} />
        <Route path="/start/suggestion" element={<SuggestWorkoutPage />} />

        {/* Standard pages with nav layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/exercises/new" element={<ExerciseFormPage />} />
          <Route path="/exercises/:id/edit" element={<ExerciseFormPage />} />
          <Route path="/schemas" element={<SchemasPage />} />
          <Route path="/schemas/new" element={<SchemaFormPage />} />
          <Route path="/schemas/:id" element={<SchemaDetailPage />} />
          <Route path="/schemas/:id/edit" element={<SchemaFormPage />} />
          <Route path="/start" element={<StartWorkoutPage />} />
          <Route path="/start/history" element={<WorkoutHistoryPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/start" replace />} />
        </Route>
      </Routes>
      <SchemaImportHandler />
      <ReloadPrompt />
    </Suspense>
  );
}

import { lazy, Suspense, type ReactElement } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ReloadPrompt } from './components/ReloadPrompt';
import { SchemaImportHandler } from './components/SchemaImportHandler';
import { useFeatureEnabled } from './hooks/useSettings';
import type { AppSettings } from './db/index';

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
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';

// Heavy / optional pages — lazy-loaded so recharts and the nutrition/planner
// modules stay out of the initial bundle.
const ProgressPage = lazy(() => import('./features/training/pages/ProgressPage').then(m => ({ default: m.ProgressPage })));
const PlannerPage = lazy(() => import('./features/planner/pages/PlannerPage').then(m => ({ default: m.PlannerPage })));
const WeekPlanFormPage = lazy(() => import('./features/planner/pages/WeekPlanFormPage').then(m => ({ default: m.WeekPlanFormPage })));
const NutritionPage = lazy(() => import('./features/nutrition/pages/NutritionPage').then(m => ({ default: m.NutritionPage })));
const FoodsPage = lazy(() => import('./features/nutrition/pages/FoodsPage').then(m => ({ default: m.FoodsPage })));
const FoodFormPage = lazy(() => import('./features/nutrition/pages/FoodFormPage').then(m => ({ default: m.FoodFormPage })));
const RecipesPage = lazy(() => import('./features/nutrition/pages/RecipesPage').then(m => ({ default: m.RecipesPage })));
const RecipeFormPage = lazy(() => import('./features/nutrition/pages/RecipeFormPage').then(m => ({ default: m.RecipeFormPage })));
const OAuthCallbackPage = lazy(() => import('./features/google-health/pages/OAuthCallbackPage').then(m => ({ default: m.OAuthCallbackPage })));

/** Guards an optional feature's routes; redirects home when the feature is off. */
function FeatureRoute({
  feature,
  children,
}: {
  feature: keyof AppSettings['features'];
  children: ReactElement;
}) {
  const enabled = useFeatureEnabled(feature);
  if (enabled === undefined) return null; // settings still loading
  if (!enabled) return <Navigate to="/start" replace />;
  return children;
}

export function App() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Routes>
        {/* OAuth callback — no nav layout, handles redirect from Google (E7-05) */}
        <Route path="/oauth/google/callback" element={<OAuthCallbackPage />} />

        {/* Workout pages have their own minimal layout */}
        <Route path="/workout/:id" element={<WorkoutPage />} />
        <Route path="/workout/:id/edit" element={<WorkoutEditPage />} />
        <Route path="/workout/:id/summary" element={<WorkoutSummaryPage />} />

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
          <Route path="/progress" element={<ProgressPage />} />

          {/* Optional: nutrition module (E5/E6) */}
          <Route path="/nutrition" element={<FeatureRoute feature="nutrition"><NutritionPage /></FeatureRoute>} />
          <Route path="/foods" element={<FeatureRoute feature="nutrition"><FoodsPage /></FeatureRoute>} />
          <Route path="/foods/new" element={<FeatureRoute feature="nutrition"><FoodFormPage /></FeatureRoute>} />
          <Route path="/foods/:id/edit" element={<FeatureRoute feature="nutrition"><FoodFormPage /></FeatureRoute>} />
          <Route path="/recipes" element={<FeatureRoute feature="nutrition"><RecipesPage /></FeatureRoute>} />
          <Route path="/recipes/new" element={<FeatureRoute feature="nutrition"><RecipeFormPage /></FeatureRoute>} />
          <Route path="/recipes/:id/edit" element={<FeatureRoute feature="nutrition"><RecipeFormPage /></FeatureRoute>} />

          {/* Optional: planner module (E9) */}
          <Route path="/planner" element={<FeatureRoute feature="planner"><PlannerPage /></FeatureRoute>} />
          <Route path="/planner/new" element={<FeatureRoute feature="planner"><WeekPlanFormPage /></FeatureRoute>} />
          <Route path="/planner/:id/edit" element={<FeatureRoute feature="planner"><WeekPlanFormPage /></FeatureRoute>} />

          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/start" replace />} />
        </Route>
      </Routes>
      <SchemaImportHandler />
      <ReloadPrompt />
    </Suspense>
  );
}

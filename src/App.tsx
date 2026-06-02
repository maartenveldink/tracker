import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ExercisesPage } from './features/training/pages/ExercisesPage';
import { ExerciseFormPage } from './features/training/pages/ExerciseFormPage';
import { SchemasPage } from './features/training/pages/SchemasPage';
import { SchemaFormPage } from './features/training/pages/SchemaFormPage';
import { SchemaDetailPage } from './features/training/pages/SchemaDetailPage';
import { WorkoutPage } from './features/training/pages/WorkoutPage';
import { WorkoutEditPage } from './features/training/pages/WorkoutEditPage';
import { WorkoutSummaryPage } from './features/training/pages/WorkoutSummaryPage';
import { StartWorkoutPage } from './features/training/pages/StartWorkoutPage';
import { ProgressPage } from './features/training/pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlannerPage } from './features/planner/pages/PlannerPage';
import { WeekPlanFormPage } from './features/planner/pages/WeekPlanFormPage';
import { NutritionPage } from './features/nutrition/pages/NutritionPage';
import { FoodsPage } from './features/nutrition/pages/FoodsPage';
import { FoodFormPage } from './features/nutrition/pages/FoodFormPage';
import { RecipesPage } from './features/nutrition/pages/RecipesPage';
import { RecipeFormPage } from './features/nutrition/pages/RecipeFormPage';
import { OAuthCallbackPage } from './features/google-health/pages/OAuthCallbackPage';

export function App() {
  return (
    <Routes>
      {/* OAuth callback — no nav layout, handles redirect from Google (E7-05) */}
      <Route path="/oauth/google/callback" element={<OAuthCallbackPage />} />

      {/* Workout pages have their own minimal layout */}
      <Route path="/workout/:id" element={<WorkoutPage />} />
      <Route path="/workout/:id/edit" element={<WorkoutEditPage />} />
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
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/foods/new" element={<FoodFormPage />} />
        <Route path="/foods/:id/edit" element={<FoodFormPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/new" element={<RecipeFormPage />} />
        <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/planner/new" element={<WeekPlanFormPage />} />
        <Route path="/planner/:id/edit" element={<WeekPlanFormPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/exercises" replace />} />
      </Route>
    </Routes>
  );
}

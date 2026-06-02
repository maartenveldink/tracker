import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useRecipes, deleteRecipe, isRecipeInUse } from '../hooks/useRecipes';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function RecipesPage() {
  const recipes = useRecipes();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    inUse: boolean;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!search) return recipes;
    const q = search.toLowerCase();
    return recipes.filter(r => r.name.toLowerCase().includes(q));
  }, [recipes, search]);

  async function handleDeleteClick(id: number, name: string) {
    const inUse = await isRecipeInUse(id);
    setDeleteTarget({ id, name, inUse });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteRecipe(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Recepten"
        actions={
          <Button asChild size="sm">
            <Link to="/recipes/new">
              <Plus className="h-4 w-4" />
              Nieuw
            </Link>
          </Button>
        }
      />

      <div className="px-4 py-3">
        <Input
          type="text"
          placeholder="Zoek recept..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="px-4 space-y-2 pb-4">
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Geen recepten gevonden.
          </p>
        )}
        {filtered.map(recipe => (
          <Card key={recipe.id} className="shadow-none">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
                  className="text-left w-full"
                >
                  <h3 className="font-medium text-sm truncate">{recipe.name}</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {recipe.totalWeight}g totaal &middot;{' '}
                    {Math.round(recipe.calories)} kcal &middot;{' '}
                    E {recipe.protein}g &middot; K {recipe.carbs}g &middot; V {recipe.fat}g
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {recipe.ingredients.length} ingredienten
                  </p>
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDeleteClick(recipe.id!, recipe.name)}
                aria-label={`Verwijder ${recipe.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Recept verwijderen"
        message={
          deleteTarget?.inUse
            ? `"${deleteTarget.name}" wordt gebruikt in de daglog. Weet je zeker dat je dit wilt verwijderen?`
            : `Weet je zeker dat je "${deleteTarget?.name}" wilt verwijderen?`
        }
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

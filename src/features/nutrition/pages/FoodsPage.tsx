import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useFoods, deleteFood, isFoodInUse } from '../hooks/useFoods';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function FoodsPage() {
  const foods = useFoods();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    inUse: boolean;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!search) return foods;
    const q = search.toLowerCase();
    return foods.filter(f => f.name.toLowerCase().includes(q));
  }, [foods, search]);

  async function handleDeleteClick(id: number, name: string) {
    const inUse = await isFoodInUse(id);
    setDeleteTarget({ id, name, inUse });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteFood(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Voedingsmiddelen"
        actions={
          <Button asChild size="sm">
            <Link to="/foods/new">
              <Plus className="h-4 w-4" />
              Nieuw
            </Link>
          </Button>
        }
      />

      <div className="px-4 py-3">
        <Input
          type="text"
          placeholder="Zoek voedingsmiddel..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="px-4 space-y-2 pb-4">
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Geen voedingsmiddelen gevonden.
          </p>
        )}
        {filtered.map(food => (
          <Card key={food.id} className="shadow-none">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/foods/${food.id}/edit`)}
                  className="text-left w-full"
                >
                  <h3 className="font-medium text-sm truncate">{food.name}</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {food.servingSize}g portie &middot;{' '}
                    {Math.round(food.calories)} kcal &middot;{' '}
                    E {food.protein}g &middot; K {food.carbs}g &middot; V {food.fat}g
                  </p>
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDeleteClick(food.id!, food.name)}
                aria-label={`Verwijder ${food.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Voedingsmiddel verwijderen"
        message={
          deleteTarget?.inUse
            ? `"${deleteTarget.name}" wordt gebruikt in recepten of de daglog. Weet je zeker dat je dit wilt verwijderen?`
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

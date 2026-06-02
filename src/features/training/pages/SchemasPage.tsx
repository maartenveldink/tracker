import { Link, useNavigate } from 'react-router-dom';
import { useSchemas, deleteSchema, copySchema } from '../hooks/useSchemas';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useState } from 'react';
import { Plus, Copy, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SchemasPage() {
  const schemas = useSchemas();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  async function handleCopy(id: number) {
    const newId = await copySchema(id);
    navigate(`/schemas/${newId}/edit`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteSchema(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Schema's"
        actions={
          <Button asChild size="sm">
            <Link to="/schemas/new">
              <Plus className="h-4 w-4" />
              Nieuw
            </Link>
          </Button>
        }
      />

      <div className="px-4 py-3 space-y-2">
        {schemas.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nog geen schema's aangemaakt.
          </p>
        )}
        {schemas.map(schema => (
          <Card key={schema.id} className="shadow-none">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/schemas/${schema.id}`)}
                  className="flex-1 text-left min-w-0"
                >
                  <h3 className="font-medium text-sm truncate">{schema.name}</h3>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {schema.days && schema.days.length > 0
                      ? `${schema.days.length} dagen | ${schema.days.reduce((sum, d) => sum + d.exercises.length, 0)} oefeningen`
                      : `${schema.exercises.length} oefening${schema.exercises.length !== 1 ? 'en' : ''}`
                    }
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => handleCopy(schema.id!)}
                  aria-label={`Kopieer ${schema.name}`}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => navigate(`/schemas/${schema.id}/edit`)}
                  aria-label={`Bewerk ${schema.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget({ id: schema.id!, name: schema.name })}
                  aria-label={`Verwijder ${schema.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Schema verwijderen"
        message={`Weet je zeker dat je "${deleteTarget?.name}" wilt verwijderen?`}
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

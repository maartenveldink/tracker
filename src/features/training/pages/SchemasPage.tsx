import { Link, useNavigate } from 'react-router-dom';
import { useSchemas, deleteSchema, copySchema, setSchemaActive } from '../hooks/useSchemas';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useState } from 'react';
import { Check, Copy, Pencil, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function SchemasPage() {
  const schemas = useSchemas();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  async function handleCopy(id: string) {
    const newId = await copySchema(id);
    navigate(`/schemas/${newId}/edit`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteSchema(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="px-screen-x pt-6 pb-4 space-y-gap">
      <header className="flex items-center justify-between gap-2 px-0.5">
        <h1 className="font-display text-screen font-bold tracking-tight">Schema's</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-pill px-4">
            <Link to="/schemas/import" aria-label="Importeer schema">
              <Upload className="h-4 w-4" />
              Importeer
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-pill px-4">
            <Link to="/schemas/new">+ Nieuw</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {schemas.length === 0 && (
          <p className="py-16 text-center text-muted text-small">Nog geen schema's aangemaakt.</p>
        )}
        {schemas.map(schema => (
          <Card key={schema.id} className="p-card">
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate(`/schemas/${schema.id}`)}
                className="flex-1 text-left min-w-0 min-h-touch rounded-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-display text-title font-bold truncate">{schema.name}</h3>
                  {schema.active && (
                    <span className="shrink-0 rounded-pill bg-accent px-2.5 py-0.5 text-caption font-bold text-accent-foreground">
                      Actief
                    </span>
                  )}
                </div>
                <p className="text-muted text-caption mt-0.5">
                  {schema.days && schema.days.length > 0
                    ? `${schema.days.length} dagen · ${schema.days.reduce((sum, d) => sum + d.exercises.length, 0)} oefeningen`
                    : `${schema.exercises.length} oefening${schema.exercises.length !== 1 ? 'en' : ''}`}
                </p>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className={schema.active ? 'text-accent' : 'text-muted'}
                onClick={() => setSchemaActive(schema.id, !schema.active)}
                aria-label={schema.active ? `Niet meer actief: ${schema.name}` : `Activeer ${schema.name}`}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted"
                onClick={() => handleCopy(schema.id)}
                aria-label={`Kopieer ${schema.name}`}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted"
                onClick={() => navigate(`/schemas/${schema.id}/edit`)}
                aria-label={`Bewerk ${schema.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted hover:text-danger"
                onClick={() => setDeleteTarget({ id: schema.id, name: schema.name })}
                aria-label={`Verwijder ${schema.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
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

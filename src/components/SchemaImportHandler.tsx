import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from './ConfirmDialog';
import {
  decodeSchemaParam,
  summarizeSharedSchema,
  importSharedSchema,
  type SharedSchema,
} from '../features/training/lib/schemaShare';

/**
 * Detects a `?importSchema=` parameter (from a shared QR/link), and offers to
 * import the schema. The parameter is read once on mount so a route redirect
 * can't drop it before we capture it.
 */
export function SchemaImportHandler() {
  const navigate = useNavigate();
  const [shared, setShared] = useState<SharedSchema | null>(() => {
    const param = new URLSearchParams(window.location.search).get('importSchema');
    return param ? decodeSchemaParam(param) : null;
  });
  const [busy, setBusy] = useState(false);

  function clearParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete('importSchema');
    window.history.replaceState({}, '', url.toString());
  }

  async function confirm() {
    if (!shared) return;
    setBusy(true);
    try {
      const id = await importSharedSchema(shared);
      clearParam();
      setShared(null);
      navigate(`/schemas/${id}`);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    clearParam();
    setShared(null);
  }

  if (!shared) return null;

  return (
    <ConfirmDialog
      open
      title="Schema importeren"
      message={`Wil je het schema "${shared.name}" toevoegen? (${summarizeSharedSchema(shared)})`}
      confirmLabel={busy ? 'Bezig…' : 'Importeren'}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
}

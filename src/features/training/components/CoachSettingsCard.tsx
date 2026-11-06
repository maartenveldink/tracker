import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  COACH_MODELS,
  clearCoachApiKey,
  isCoachModel,
  isValidApiKeyFormat,
  setCoachApiKey,
  setCoachModel,
  useCoachConfig,
} from '../lib/coachConfig';

/**
 * Settings → "Claude-coach": API key (stored locally only, see `coachConfig.ts`)
 * and model. The stored key is never shown again; it can only be replaced or
 * removed.
 */
export function CoachSettingsCard() {
  const { hasKey, model } = useCoachConfig();
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showForm = !hasKey || editing;

  // Links from the coach page land on "#claude-coach": bring the card into view.
  const { hash } = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hash === '#claude-coach') cardRef.current?.scrollIntoView({ block: 'start' });
  }, [hash]);

  function save(e: FormEvent) {
    e.preventDefault();
    const key = draft.trim();
    if (key === '') return;
    if (!isValidApiKeyFormat(key)) {
      setMessage({ type: 'error', text: 'Deze key bevat spaties of bijzondere tekens. Kopieer de key opnieuw uit de Anthropic Console.' });
      return;
    }
    try {
      setCoachApiKey(key);
      setDraft('');
      setShow(false);
      setEditing(false);
      setMessage({ type: 'success', text: 'API-key opgeslagen op dit apparaat.' });
    } catch {
      setMessage({ type: 'error', text: 'Opslaan is mislukt: de opslag van de browser is niet beschikbaar.' });
    }
  }

  function remove() {
    clearCoachApiKey();
    setDraft('');
    setEditing(false);
    setMessage({ type: 'success', text: 'API-key verwijderd.' });
  }

  return (
    <Card id="claude-coach" ref={cardRef} data-testid="coach-settings">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Claude-coach
        </CardTitle>
        <CardDescription>
          Laat Claude je training analyseren en een aangepast schema voorstellen, met je eigen Anthropic API-key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="coach-api-key" className="font-medium">API-key</Label>
          {hasKey && !editing && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground" data-testid="coach-key-status">
                Er is een API-key opgeslagen op dit apparaat.
              </p>
              <div className="flex gap-2 shrink-0">
                <Button type="button" size="sm" variant="secondary" onClick={() => { setEditing(true); setMessage(null); }}>
                  Vervangen
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={remove}>
                  Verwijderen
                </Button>
              </div>
            </div>
          )}
          {showForm && (
            <form onSubmit={save} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id="coach-api-key"
                  type={show ? 'text' : 'password'}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="sk-ant-…"
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  aria-label={show ? 'Verberg API-key' : 'Toon API-key'}
                  aria-pressed={show}
                  onClick={() => setShow(s => !s)}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={draft.trim() === ''}>
                  Key opslaan
                </Button>
                {editing && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(''); }}>
                    Annuleren
                  </Button>
                )}
              </div>
            </form>
          )}
          {message && (
            <p role="status" className={`text-xs ${message.type === 'success' ? 'text-emerald-400' : 'text-destructive'}`}>
              {message.text}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="coach-model" className="font-medium">Model</Label>
          <select
            id="coach-model"
            className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
            value={model}
            onChange={e => {
              if (isCoachModel(e.target.value) && !setCoachModel(e.target.value)) {
                setMessage({ type: 'error', text: 'Model opslaan is mislukt: de opslag van de browser is niet beschikbaar.' });
              }
            }}
          >
            {COACH_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Privacy: bij een analyse gaat een samenvatting van je training naar Anthropic, inclusief je notities bij trainingen en
            oefeningen (geen ruwe sets of datums).
          </p>
          <p>
            De key wordt alleen in deze browser bewaard: niet gesynchroniseerd en niet in de export. “Alles wissen” verwijdert hem.
            Elke code op deze pagina kan hem lezen; stel daarom bij Anthropic een lage maandlimiet in voor deze key.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

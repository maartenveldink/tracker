import schemaFormatRaw from '../../../../docs/schema-format.json?raw';
import { UNDERTRAINED_SETS_PER_WEEK, type CoachSummary } from './coachSummary';

/** Minified JSON Schema of the readable schema format (`docs/schema-format.json`). */
export const SCHEMA_FORMAT_JSON: string = JSON.stringify(JSON.parse(schemaFormatRaw));

export interface CoachPromptOptions {
  summary: CoachSummary;
  /** Optional goal / question from the user (e.g. "meer rug", "knie-vriendelijk"). */
  goal?: string;
  /** JSON Schema text to embed; defaults to `SCHEMA_FORMAT_JSON`. */
  schemaFormat?: string;
}

/** The compact (single-line) summary JSON, as it is put in the prompt. */
export function summaryToJson(summary: CoachSummary): string {
  return JSON.stringify(summary);
}

/**
 * Prompt (Dutch) for pasting into claude.ai: instructions + JSON Schema of the
 * answer + training summary. It asks for an analysis in Dutch and a proposal as
 * JSON that can be pasted back into the app's schema import screen.
 */
export function buildCoachPrompt({ summary, goal, schemaFormat = SCHEMA_FORMAT_JSON }: CoachPromptOptions): string {
  const goalText = goal?.trim();
  const lines = [
    'Je bent mijn krachttraining-coach. Hieronder staat een samenvatting van mijn laatste trainingsperiode, mijn huidige schema en het formaat waarin je een aangepast schema moet voorstellen.',
    '',
    '## Wat ik van je vraag',
    '1. Analyseer in het Nederlands wat ik gedaan heb: voortgang per oefening (1RM-trend, haal ik de rep-range, overgeslagen sets), trainingsfrequentie, spiergroepverdeling en ondertrainde groepen, lichaamsgewicht en mijn eigen notities.',
    '2. Benoem waar ik achterblijf en wat ik zou moeten aanpassen, kort en concreet.',
    '3. Stel daarna een aangepast schema voor als JSON volgens het JSON Schema hieronder. Het huidige schema blijft bestaan; jouw voorstel wordt als nieuw schema opgeslagen.',
    '',
    '## Regels voor het voorstel',
    '- Gebruik bij voorkeur exact de namen uit "existingExercises"; alleen als er echt geen passende oefening bestaat mag je een nieuwe naam gebruiken.',
    '- Zet bij elke oefening die je toevoegt of waarvan je sets, reps, gewicht of rust wijzigt een korte "reason" (Nederlands) met de reden; bij een vervangen oefening zet je die op de nieuwe oefening. Laat "reason" weg bij ongewijzigde oefeningen. Oefeningen die je schrapt, benoem je in je analyse.',
    '- Gewichten zijn in kg. Houd startgewichten realistisch ten opzichte van de eind-1RM in de samenvatting.',
    '- Het voorstel moet voldoen aan het JSON Schema (volledige veldnamen; gebruik óf "exercises" óf "days").',
    '',
    '## Antwoordformaat',
    'Geef eerst je analyse in gewone tekst. Sluit af met het voorgestelde schema in één JSON-codeblok (```json). Ik kopieer alleen dat codeblok en plak het in de importfunctie van mijn app (Schema\'s → Importeer schema), dus zet er niets anders in dan geldige JSON.',
    '',
  ];
  if (goalText) {
    lines.push('## Mijn doel / vraag', goalText, '');
  }
  lines.push(
    '## Uitleg bij de samenvatting',
    `- Periode: ${summary.period.weeks} weken. "week" is relatief: week 1 is de oudste week, week ${summary.period.weeks} de meest recente (laatste 7 dagen).`,
    `- e1rm = geschat 1RM (formule ${summary.period.e1rmFormula}) van de beste set; startKg = eerste sessie, endKg = laatste sessie in de periode.`,
    '- perSession: reps = behaalde reps (min-max over de sets), target = geplande rep-range, skippedSets = overgeslagen of niet voltooide sets.',
    '- perWeek: avgKg = gemiddeld gewicht, volumeKg = gewicht × reps. avgKg null = lichaamsgewichtoefening (dan telt totalReps).',
    `- muscles.sets telt primaire spieren als 1 en secundaire als 0,5 per set. undertrained = minder dan ${UNDERTRAINED_SETS_PER_WEEK} gewogen sets per week.`,
    '- setsDone / setsSkipped (per oefening) en sets / skippedSets (per sessie): gedaan versus overgeslagen of niet voltooid; bij oefeningen per kant (links/rechts) telt een heel paar als één set.',
    '- frequency: perWeek = aantal trainingen per relatieve week, weeksWithoutSession = weken zonder training, byDay = trainingen per schemadag, avgDurationMin = gemiddelde duur.',
    '- De samenvatting bevat alle trainingen in de periode, ook die van andere schema\'s en vrije trainingen; currentSchema is het schema dat ik wil laten aanpassen.',
    '- bodyWeight: startKg, endKg en changeKg over de periode (null = geen weegmomenten). notes: mijn eigen opmerkingen bij trainingen en oefeningen, letterlijk overgenomen.',
    '- Er zijn bewust geen ruwe sets of datums meegestuurd.',
    '',
    '## JSON Schema van het antwoord',
    schemaFormat,
    '',
    '## Samenvatting van mijn training (JSON)',
    summaryToJson(summary),
    '',
  );
  return lines.join('\n');
}

import type { PartRef, SupersetDot } from '../lib/supersetRegistration';
import { LiveZigzagRow } from './LiveZigzagRow';

interface LiveSupersetProgressProps {
  dots: SupersetDot[];
  rounds: number;
  /** Exercise names of A and B (group label for screen readers). */
  names: [string, string];
  /** The member whose exercise is on screen (name, set card): `data-shown` on its dots. */
  shownMember: 0 | 1;
  onOpen: (part: PartRef) => void;
  onAdd: () => void;
}

/**
 * DESIGN §4 "Set-voortgang, superset" (`TrainingE2.dc.html`): the zigzag with
 * exercise A on the top row and B on the bottom row (A1 → B1 → A2 → B2 …), the
 * number in a dot is the round, `A`/`B` in the gutter scroll along. The plus dot
 * after the last round adds a round. An empty part (a member with fewer sets)
 * has no dot and no line; the rounds keep their columns.
 */
export function LiveSupersetProgress({ dots, rounds, names, shownMember, onOpen, onAdd }: LiveSupersetProgressProps) {
  return (
    <LiveZigzagRow
      label={`Sets superset, A ${names[0]}, B ${names[1]}`}
      rowLabels={['A', 'B']}
      dots={dots.map(d => ({
        key: d.slot,
        slot: d.slot,
        number: d.number,
        state: d.state,
        lineOn: d.lineOn,
        pressed: d.pressed,
        ariaLabel: d.ariaLabel,
        testId: 'superset-dot',
        data: { 'data-part': d.part, 'data-set': d.number, 'data-shown': String(d.member === shownMember) },
        onClick: () => onOpen({ member: d.member, setIdx: d.setIdx }),
      }))}
      plusSlot={2 * rounds}
      // Design aria "Set toevoegen": a round is shown as a set ("Set 3") everywhere.
      plusLabel="Set toevoegen"
      onAdd={onAdd}
    />
  );
}

import type { SideDot } from '../lib/setRegistration';
import { LiveZigzagRow } from './LiveZigzagRow';

interface LiveSideProgressProps {
  dots: SideDot[];
  onOpen: (setIndex: number) => void;
  onAdd: () => void;
}

/**
 * DESIGN §4 "Set-voortgang, unilateraal" (`TrainingD1U.dc.html`): one dot per
 * part, left on the top row and right on the bottom row, in zigzag order
 * L1 → R1 → L2 → R2. There is no side switch: the row of the opened dot shows
 * the side (the L/R labels at the start scroll along).
 */
export function LiveSideProgress({ dots, onOpen, onAdd }: LiveSideProgressProps) {
  return (
    <LiveZigzagRow
      label="Sets, links en rechts"
      rowLabels={['L', 'R']}
      dots={dots.map((d, k) => ({
        key: d.index,
        slot: k,
        number: d.number,
        state: d.state,
        lineOn: d.lineOn,
        pressed: d.pressed,
        ariaLabel: d.ariaLabel,
        testId: 'side-dot',
        data: { 'data-side': d.side, 'data-set': d.number },
        onClick: () => onOpen(d.index),
      }))}
      plusSlot={dots.length}
      plusLabel="Set toevoegen"
      onAdd={onAdd}
    />
  );
}

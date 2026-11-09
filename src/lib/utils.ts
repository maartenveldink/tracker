import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Knows the design-token utilities (tailwind.config.js) so they merge with the right group. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'nav', 'small', 'body', 'body-lg', 'title', 'stat', 'screen', 'hero', 'big', 'stepper'] }],
      rounded: [{ rounded: ['chip', 'row', 'button', 'tile', 'card', 'sheet', 'pill'] }],
      h: [{ h: ['touch', 'button', 'button-train', 'nav'] }],
      w: [{ w: ['touch', 'button', 'button-train', 'nav'] }],
      'min-h': [{ 'min-h': ['touch', 'button', 'button-train', 'nav'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** m:ss or h:mm:ss — used for the live timer during a workout. */
export function formatDurationClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** "Xu Ymin" — used in the workout summary. */
export function formatDurationLong(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}u ${minutes}min`;
  return `${minutes} min`;
}

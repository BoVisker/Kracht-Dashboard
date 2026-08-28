import type { PlannedSession } from '../lib/types/canonical'

/**
 * Seed data, not hardcoded plan logic -- inserted as the starting template
 * on first setup, editable from Settings afterwards without touching code.
 * This is the athlete's own weekly split: kept as-is deliberately even
 * though the concurrent-training research done alongside this app flagged
 * Wednesday Legs -> Thursday Interval as tight on recovery (~24-30h vs. the
 * usual 48-72h guidance) -- the trade-off was raised and the athlete chose
 * to keep the original split rather than reshuffle Push/Pull days to fix it.
 */
export const SEED_PLANNED_SESSIONS: Omit<PlannedSession, 'id'>[] = [
  { dayOfWeek: 'monday', sortOrder: 0, trainingType: 'push', trainingSubtype: 'heavy', label: 'Push Heavy', notes: null },
  { dayOfWeek: 'tuesday', sortOrder: 0, trainingType: 'pull', trainingSubtype: 'heavy', label: 'Pull Heavy', notes: null },
  { dayOfWeek: 'tuesday', sortOrder: 1, trainingType: 'cardio', trainingSubtype: null, label: 'Easy Run', notes: 'Rustig tempo, praat-test.' },
  { dayOfWeek: 'wednesday', sortOrder: 0, trainingType: 'legs', trainingSubtype: null, label: 'Legs', notes: null },
  { dayOfWeek: 'thursday', sortOrder: 0, trainingType: 'push', trainingSubtype: 'volume', label: 'Push Volume', notes: null },
  { dayOfWeek: 'thursday', sortOrder: 1, trainingType: 'cardio', trainingSubtype: null, label: 'Interval Run', notes: null },
  { dayOfWeek: 'friday', sortOrder: 0, trainingType: 'pull', trainingSubtype: 'volume', label: 'Pull Volume', notes: null },
  { dayOfWeek: 'saturday', sortOrder: 0, trainingType: 'rest', trainingSubtype: null, label: 'Rust', notes: null },
  { dayOfWeek: 'sunday', sortOrder: 0, trainingType: 'cardio', trainingSubtype: null, label: 'Long Easy Run', notes: 'Elke week iets langer, max +5-10% t.o.v. langste run van de afgelopen 30 dagen.' },
]

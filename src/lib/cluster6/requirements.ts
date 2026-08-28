/**
 * Seed data, not business logic — this is exactly what brief section 22/23
 * asks for: Defensie can change these numbers without a code change.
 *
 * Re-verified 2026-08-28 directly against werkenbijdefensie.nl (not the
 * fitvoordefensie.nl third-party mirror used at the 2026-08-11 pass, which
 * couldn't reach the official domain). Two official pages independently
 * confirm the same figures: werkenbijdefensie.nl/korps-mariniers (Fitheidstest
 * + Cluster 6 functional test breakdown) and werkenbijdefensie.nl/training/10
 * (Cluster 6 keuringsfit programme, confirms the 12-minutenloop figure).
 * `sourceVerifiedAt` records when they were last checked, and the Settings
 * page should let these be edited without redeploying the app.
 */

export type ClusterCategory = 'run' | 'march' | 'carry' | 'ball' | 'functional' | 'overhead'
export type Direction = 'higher_better' | 'lower_better'

export interface ClusterRequirement {
  id: string
  category: ClusterCategory
  name: string
  unit: string
  direction: Direction
  targetValue: number
  /** Extra context the raw number can't carry, e.g. "10 reps van 25m". */
  detail: string
  source: string
  sourceVerifiedAt: string
}

const SOURCE = 'werkenbijdefensie.nl/korps-mariniers'
const VERIFIED = '2026-08-28'

export const CLUSTER_6_REQUIREMENTS: ClusterRequirement[] = [
  {
    id: 'run-12min',
    category: 'run',
    name: '12-minuten hardlopen (Cooper test)',
    unit: 'm',
    direction: 'higher_better',
    targetValue: 2700,
    detail: '2700 meter in 12 minuten.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'march-25kg',
    category: 'march',
    name: 'Mars met 25 kg rugzak',
    unit: 'min',
    direction: 'higher_better',
    targetValue: 24,
    detail: '24 minuten lopen met een rugzak van 25 kg.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'march-35kg',
    category: 'march',
    name: 'Mars met 35 kg rugzak',
    unit: 'min',
    direction: 'higher_better',
    targetValue: 24,
    detail: '24 minuten lopen met een rugzak van 35 kg.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'march-45kg',
    category: 'march',
    name: 'Mars met 45 kg rugzak',
    unit: 'min',
    direction: 'higher_better',
    targetValue: 10,
    detail: '10 minuten lopen met een rugzak van 45 kg.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'carry-20kg',
    category: 'carry',
    name: 'Munitiekist 20 kg',
    unit: 'reps',
    direction: 'higher_better',
    targetValue: 10,
    detail: '20 kg munitiekist, 10x 25 meter dragen.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'carry-30kg',
    category: 'carry',
    name: 'Munitiekist 30 kg',
    unit: 'reps',
    direction: 'higher_better',
    targetValue: 10,
    detail: '30 kg munitiekist, 10x 25 meter dragen.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'carry-40kg',
    category: 'carry',
    name: 'Munitiekist 40 kg',
    unit: 'reps',
    direction: 'higher_better',
    targetValue: 5,
    detail: '40 kg munitiekist, 5x 25 meter dragen.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'ball-rotation',
    category: 'ball',
    name: 'Draaibeweging met bal',
    unit: 's',
    direction: 'higher_better',
    targetValue: 120,
    detail: '120 seconden volhouden.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'overhead-steekgewicht',
    category: 'overhead',
    name: 'Boven schouderhoogte werken (steekgewicht)',
    unit: 's',
    direction: 'higher_better',
    targetValue: 60,
    detail: '60 seconden boven schouderhoogte een steekgewicht verplaatsen.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'overhead-vleugelmoeren',
    category: 'overhead',
    name: 'Boven schouderhoogte werken (vleugelmoeren)',
    unit: 's',
    direction: 'higher_better',
    targetValue: 60,
    detail: '60 seconden aan vleugelmoeren draaien boven schouderhoogte.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'pullups-2min',
    category: 'functional',
    name: 'Pull-ups',
    unit: 'reps',
    direction: 'higher_better',
    targetValue: 4,
    detail: 'Minimaal 4 pull-ups in 2 minuten.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'situps-2min',
    category: 'functional',
    name: 'Sit-ups',
    unit: 'reps',
    direction: 'higher_better',
    targetValue: 30,
    detail: 'Minimaal 30 sit-ups in 2 minuten.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
  {
    id: 'pushups-2min',
    category: 'functional',
    name: 'Push-ups',
    unit: 'reps',
    direction: 'higher_better',
    targetValue: 30,
    detail: 'Minimaal 30 push-ups in 2 minuten.',
    source: SOURCE,
    sourceVerifiedAt: VERIFIED,
  },
]

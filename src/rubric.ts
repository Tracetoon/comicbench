/**
 * The comicbench rubric: what judges score, on which anchored 1–5 scale, and
 * how much each criterion weighs. Bump RUBRIC_VERSION whenever the meaning of
 * a criterion, an anchor, a gate or a weight changes; runs compare only when
 * their rubric versions match.
 */
export const RUBRIC_VERSION = 2;

/**
 * v2 (round 2): v1's judges sat at the ceiling (art style 4.97-5.00,
 * relevance about 4.9). A competent comic now scores 3, a 4 or 5 must name
 * its strength, art style is judged against the one style the script asked
 * for, and relevance runs the swap test out loud.
 */
export const SCALE = `Score each criterion on 1-5 using its anchors; 2 and 4 sit between. A competent comic with nothing wrong and nothing special scores 3. A 4 needs a strength you can name; a 5 needs a strength a developer would point out to a colleague. Name that strength in the reason for every 4 or 5; if you can't, the score is 3 at most. Use null only when you truly cannot assess it from what you were given. Give a one-sentence reason for each score.`;

/** Stage A sees only the image and the genre's art sheet; stage B adds the PR evidence. */
export type Stage = 'blind' | 'context';

export interface Criterion {
  id: string;
  name: string;
  /** Points out of 100 for one comic. */
  weight: number;
  stage: Stage;
  question: string;
  /** What a 1, 3 and 5 look like; 2 and 4 sit between. */
  anchors: { 1: string; 3: string; 5: string };
}

export const CRITERIA: Criterion[] = [
  {
    id: 'humor',
    name: 'Humor',
    weight: 25,
    stage: 'blind',
    question: 'Would a developer actually smile? Surprise, a clear punchline, timing.',
    anchors: {
      1: 'No identifiable joke, or the punchline needs explaining.',
      3: 'A clear joke that lands mildly; a familiar shape done competently.',
      5: 'A surprising, well-timed punchline a developer would share; not the first joke anyone would make.',
    },
  },
  {
    id: 'relevance',
    name: 'Change relevance',
    weight: 20,
    stage: 'context',
    question: 'Swap test: is the joke about this change, or would it fit another PR? In the reason, name another kind of PR it would also fit, or say none.',
    anchors: {
      1: 'Generic; the comic would fit almost any pull request.',
      3: 'Recognizably this area of the code, but the joke is not about what changed, or it fits other PRs in the area.',
      5: 'The joke only works because of what this PR changed; you can name no other PR it would fit.',
    },
  },
  {
    id: 'fidelity',
    name: 'Factual fidelity',
    weight: 15,
    stage: 'context',
    question: 'Do names, numbers and mechanisms match the brief, facts and diff, with nothing invented?',
    anchors: {
      1: 'States or implies things the evidence contradicts or never shows.',
      3: 'Accurate in substance, with loose or simplified details.',
      5: 'Every name, number and mechanism shown matches the evidence.',
    },
  },
  {
    id: 'audience',
    name: 'Audience fit',
    weight: 10,
    stage: 'context',
    question: 'Does it land for developers and AI engineers: insider truth, not generic office humor?',
    anchors: {
      1: 'Generic office or tech-support humor.',
      3: 'Developers get it; nothing specific to how they or their agents work.',
      5: 'An insider truth about building software with agents that rings true.',
    },
  },
  {
    id: 'clarity',
    name: 'Clarity and cold read',
    weight: 10,
    stage: 'blind',
    question: 'Can someone who never saw the PR follow each panel and the ending?',
    anchors: {
      1: 'Panels do not connect, or the ending is unreadable.',
      3: 'Followable with effort; one beat is muddy.',
      5: 'Every beat reads at a glance, including on a phone.',
    },
  },
  {
    id: 'genre',
    name: 'Genre adherence',
    weight: 10,
    stage: 'context',
    question: "Do the genre's setting, archetypes and props carry the change, rather than decorate it?",
    anchors: {
      1: 'The genre is missing or contradicts the comic.',
      3: 'The genre is present as scenery; the joke would work without it.',
      5: "The change is told through the genre's own stakes and props.",
    },
  },
  {
    id: 'artStyle',
    name: 'Art-style fidelity',
    weight: 10,
    stage: 'blind',
    question: 'Does it look like the one art style the script asked for (line, palette, rendering, lettering)?',
    anchors: {
      1: 'A different style, a 3D render or a photo-like image.',
      3: 'A drawn comic loosely in the requested style, or with visible lapses: mixed rendering, garbled or uneven lettering, off-model panels.',
      5: 'The requested style in every panel, consistent characters, clean lettering; nothing off-model.',
    },
  },
];

/** Pass/fail checks; a failed gate scores the comic 0 whatever its points. */
export const GATES = [
  { id: 'factualIntegrity', question: 'Nothing contradicts the brief, the facts or the diff.' },
  { id: 'phoneLegibility', question: 'Every required word reads at 360 px (host-checked).' },
  { id: 'punchUp', question: 'Punches at problems, not people; no franchise characters or marks.' },
  { id: 'outputContract', question: 'A valid comic.json and a drawn image exist.' },
] as const;
export type GateId = (typeof GATES)[number]['id'];

/** Variety, judged once per set of comics (one skill, one genre, one split). */
export const SET_CRITERIA = [
  {
    id: 'premiseVariety',
    share: 0.4,
    question: 'Distinct premises and joke shapes across the set, rather than one joke retold.',
  },
  {
    id: 'castVariety',
    share: 0.3,
    question: 'New characters per comic; recurring archetypes are fine, the same character every time is not.',
  },
  {
    id: 'formatVariety',
    share: 0.3,
    question: 'A spread of formats and composition families.',
  },
] as const;
export type SetCriterionId = (typeof SET_CRITERIA)[number]['id'];

/** The headline: mostly the comics themselves, partly the variety of the set. */
export const HEADLINE = { comic: 0.8, set: 0.2 } as const;

export const TOTAL_WEIGHT = CRITERIA.reduce((s, c) => s + c.weight, 0);

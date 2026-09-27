// Everything the pages say comes from README.md (src/data/readme.json, written by
// scripts/sync.mjs). The only words that live here are the site's own chrome.
import readme from '../data/readme.json';

export const data = readme;
export const REPO = readme.repo;
export type Section = (typeof readme.sections)[number];
export type Resource = Section['resources'][number];

export const sectionHref = (s: Pick<Section, 'slug'>) => `/${s.slug}/`;
export const sectionByNum = (n: number) => readme.sections.find((s) => s.num === n)!;
export const pad = (n: number) => String(n).padStart(2, '0');

export const LEVEL_NAMES = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

/** Entries as the finder island wants them, with their section attached. */
export const finderItems = (sections: Section[]) =>
  sections.flatMap((s) => s.resources.map((r) => ({ ...r, section: { num: s.num, title: s.title, href: sectionHref(s) } })));

export const finderLabels = (total: number) => ({
  placeholder: `Search ${total} resources by name, topic, or site`,
  allLevels: 'All levels',
  allGroups: 'All',
  commercial: 'Commercial author',
  noResults: 'Nothing matches. Try a shorter word.',
  showMore: 'Show more',
  levelNames: LEVEL_NAMES,
  showing: '{n} of {total}',
  showingAll: '{total} resources',
  level: 'Level',
});

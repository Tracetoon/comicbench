import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHECKLIST_SCHEMA, CHECKLIST_VERSION, applyChecklistEvidence, checklistDiagnosticsPresent, checklistPrompt, type Checklist } from './checklist.ts';
import { codexExec } from './codex.ts';
import { isPageRole, PAGE_ROLE_PROMPT, PAGE_ROLE_SCHEMA } from './judges.ts';
import { tracetoonModules } from './round.ts';
import { RUBRIC_VERSION } from './rubric.ts';

interface Fixture {
  id: string;
  image: string;
  script?: string;
  design?: string;
  checks: Record<string, (checklist: Checklist) => boolean>;
}

const fleetScript = JSON.stringify({
  characters: [{ name: 'Vela', description: 'The fleet captain in a teal uniform.' }],
  panels: [{
    scene: 'The captain orders the silver wing into the fight. Two opposing fleets exchange fire and the blue formation turns in response.',
  }],
});
const fleetDesign = JSON.stringify({ concepts: [{ beats: ['The blue fleet engages the silver fleet, which replies with a visible barrage.'] }] });

const backgrounds = `<defs>
  <g id="fighter"><path d="M-49 -14L-15 -14 -27 -43 24 -21 54 0 24 21 -27 43 -15 14 -49 14Z" stroke="#111827" stroke-width="4" stroke-linejoin="round"/><path d="M-4 0Q8 -15 24 0Q8 15 -4 0Z" fill="#e4f4ff" stroke="#111827" stroke-width="3"/></g>
  <g id="burst" fill="#fff4a3" stroke="#f89a38" stroke-width="3"><path d="M0 -27L7 -9 28 -19 16 -1 30 14 9 10 5 29 -4 14 -24 25 -15 6 -31 -7 -11 -8Z"/></g>
</defs>`;

const page = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="460" viewBox="0 0 760 460">
  <rect width="760" height="460" fill="#fffdf4"/>${backgrounds}${body}</svg>`;

const duelPage = page(`
  <path d="M18 18H742V176L18 253Z M18 265L742 189V442H18Z" fill="#17213e" stroke="#151826" stroke-width="5"/>
  <g fill="#b5c5ef"><circle cx="420" cy="40" r="3"/><circle cx="695" cy="71" r="2"/><circle cx="48" cy="175" r="3"/><circle cx="537" cy="390" r="3"/></g>
  <g stroke-linecap="round" fill="none"><path d="M155 115L348 105M176 133L324 127" stroke="#79e8fc" stroke-width="5"/><path d="M572 104L406 112M571 121L430 123" stroke="#f69381" stroke-width="6"/></g>
  <use href="#fighter" transform="translate(115 120)" fill="#50c8de"/>
  <use href="#fighter" transform="translate(629 110) rotate(180)" fill="#ed785e"/>
  <use href="#burst" transform="translate(374 115)"/>
  <path d="M105 360Q191 403 275 319" fill="none" stroke="#71e2f0" stroke-width="9" stroke-linecap="round"/>
  <use href="#fighter" transform="translate(300 310) rotate(-29)" fill="#50c8de"/>
  <path d="M582 299L337 300" stroke="#f69381" stroke-width="5"/>
  <use href="#fighter" transform="translate(635 299) rotate(180)" fill="#ed785e"/>
  <use href="#burst" transform="translate(371 300) scale(.7)"/>
  <text x="122" y="304" fill="#fff4a3" font-family="DejaVu Sans, sans-serif" font-size="30" font-weight="bold">WHIP!</text>`);

const backdropPage = page(`
  <rect x="18" y="18" width="724" height="235" fill="#17213e" stroke="#151826" stroke-width="5"/>
  <path d="M20 221L741 149" fill="none" stroke="#b0b8cc" stroke-width="3"/>
  <g fill="#67c8d0"><use href="#fighter" transform="translate(126 105) scale(.65)"/><use href="#fighter" transform="translate(293 107) scale(.81)"/><use href="#fighter" transform="translate(450 107) scale(.81)"/><use href="#fighter" transform="translate(612 106) scale(.65)"/></g>
  <rect x="18" y="263" width="724" height="179" fill="#dbe5ec" stroke="#151826" stroke-width="5"/>
  <circle cx="203" cy="348" r="36" fill="#c48367" stroke="#151826" stroke-width="4"/>
  <path d="M147 428Q147 393 203 393Q259 393 259 428Z" fill="#aaaeb6" stroke="#151826" stroke-width="4"/>
  <rect x="319" y="316" width="218" height="65" rx="6" fill="white" stroke="#151826" stroke-width="3"/>
  <text x="364" y="358" fill="#151826" font-family="DejaVu Sans, sans-serif" font-size="27">CAPTAIN</text>`);

const commandPage = page(`
  <rect x="18" y="18" width="724" height="424" fill="#dee8ef" stroke="#151826" stroke-width="5"/>
  <rect x="388" y="324" width="181" height="91" rx="8" fill="#8e9eae" stroke="#151826" stroke-width="4"/>
  <g stroke="#151826" stroke-width="4">
    <circle cx="160" cy="247" r="34" fill="#bc7658"/>
    <path d="M101 415L112 303Q161 271 212 303L252 276 262 294 206 345 209 415Z" fill="#294b78"/>
    <path d="M116 301L142 291 M188 293L211 305" stroke="#f6c34c" stroke-width="10"/>
    <circle cx="532" cy="270" r="29" fill="#e3b286"/>
    <path d="M479 324Q534 293 577 328L556 354 502 334 474 365 448 354Z" fill="#5a9295"/>
    <path d="M88 48H384Q407 48 407 72V114Q407 132 384 132H209L168 200 176 132H88Q68 132 68 111V72Q68 48 88 48Z" fill="white"/>
    <path d="M436 147H663Q684 147 684 171V202Q684 220 662 220H569L538 230 544 220H436Q417 220 417 202V171Q417 147 436 147Z" fill="white"/>
  </g>
  <g fill="#151826" font-family="DejaVu Sans, sans-serif" font-size="24">
    <text x="94" y="99">Hold the bay doors!</text><text x="450" y="194">Holding, ma’am!</text>
  </g>`);

export async function runCraftCalibration(o: { reference: string; out: string; tracetoon: string; model?: string }) {
  const { svgToPng } = await tracetoonModules(o.tracetoon);
  mkdirSync(o.out, { recursive: true });
  const png = async (id: string, svg: string) => {
    const path = join(o.out, id + '.png');
    writeFileSync(path, await svgToPng(svg, 760));
    return path;
  };
  const archived = (id: string, kase: string, sample: string, checks: Fixture['checks']): Fixture => {
    const dir = join(o.reference, 'comics', kase, sample);
    return {
      id,
      image: join(dir, 'art', 'page-760.png'),
      script: readFileSync(join(dir, 'packet', 'comic.json'), 'utf8'),
      design: readFileSync(join(dir, 'packet', 'comic-design.json'), 'utf8'),
      checks,
    };
  };
  const noEngagement = (c: Checklist) => c.spaceConflict?.fleet.state === 'absent'
    && c.spaceConflict.duel.state === 'absent' && c.spaceConflict.other.state === 'absent';
  const fixtures: Fixture[] = [
    {
      id: 'drawn-duel', image: await png('drawn-duel', duelPage),
      checks: {
        'duel on page': (c) => c.spaceConflict?.duel.state === 'present',
        'angular frames': (c) => c.renderedGeometry?.features?.includes('angled') === true,
        'missing concept notes unassessed': (c) => c.spaceConflict?.considered.state === 'unclear',
      },
    },
    {
      id: 'backdrop-and-title', image: await png('backdrop-and-title', backdropPage), script: fleetScript, design: fleetDesign,
      checks: {
        'scripted combat': (c) => c.spaceConflict?.scripted.state === 'present',
        'concept combat': (c) => c.spaceConflict?.considered.state === 'present',
        'backdrop lacks visible engagement': noEngagement,
        'tilted horizon leaves rectangular frames': (c) => c.renderedGeometry?.features?.length === 0,
        'title alone insufficient': (c) => c.roleRead?.visible.state === 'absent',
      },
    },
    {
      id: 'visible-command', image: await png('visible-command', commandPage),
      script: JSON.stringify({ characters: [{ name: 'Mora', description: 'The captain directs the bay crew.' }] }),
      checks: { 'role evidenced through action': (c) => c.roleRead?.visible.state === 'present' },
    },
    archived('archive-portrait', 'vexagent-cli-snap', '1', { 'ships are backdrop': noEngagement }),
    archived('archive-diagonal-action', 'aifirstcli-learner-replay-ux', '2', {
      'diagonal action leaves rectangular frames': (c) => c.renderedGeometry?.features?.length === 0,
    }),
    archived('archive-slanted', 'tracetoon-render-name-check', '2', {
      'angular frames': (c) => c.renderedGeometry?.features?.includes('angled') === true,
    }),
  ];
  const results = await Promise.all(fixtures.map(async ({ id, image, script, design, checks }) => {
    const role = script ? await codexExec({
      prompt: PAGE_ROLE_PROMPT, cwd: o.out, images: [image], schema: PAGE_ROLE_SCHEMA,
      logDir: join(o.out, id, 'page-role'), model: o.model, noTools: true,
    }) : undefined;
    const pageRole = role?.ok && isPageRole(role.json) ? role.json : undefined;
    const reply = await codexExec({
      prompt: checklistPrompt(script, design, pageRole), cwd: o.out, images: [image], schema: CHECKLIST_SCHEMA,
      logDir: join(o.out, id), model: o.model,
    });
    const checklist = reply.ok && checklistDiagnosticsPresent(reply.json)
      ? applyChecklistEvidence(reply.json, script ? JSON.parse(script) : undefined, design, pageRole)
      : null;
    const verdicts = Object.fromEntries(Object.entries(checks).map(([name, check]) => [name, checklist ? check(checklist) : false]));
    return { id, image, verdicts, checklist, error: reply.error };
  }));
  const passed = results.every((result) => Object.values(result.verdicts).every(Boolean));
  const report = { rubricVersion: RUBRIC_VERSION, checklistVersion: CHECKLIST_VERSION, model: o.model, passed, results };
  writeFileSync(join(o.out, 'calibration-craft.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

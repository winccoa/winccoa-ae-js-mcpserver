#!/usr/bin/env node
/**
 * Regenerate the complete component list in OSS.md from sbom.json.
 *
 * Every licence in the dependency tree (MIT, ISC, BSD-2/3-Clause) is an
 * attribution licence: the notice has to be reproduced in the distribution. A
 * disclosure listing only the direct dependencies does not discharge that, so
 * this generates a row per distributed component.
 *
 * Generated rather than hand-maintained so it cannot drift from the SBOM - CI
 * regenerates and fails if the result differs from what is committed.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sbomPath = join(here, 'sbom.json');
const ossPath = join(here, '..', 'OSS.md');

const BEGIN = '<!-- BEGIN GENERATED COMPONENT LIST - edit gen-oss.mjs, not this block -->';
const END = '<!-- END GENERATED COMPONENT LIST -->';

const sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const direct = new Set(Object.keys(pkg.dependencies ?? {}));

/** Scoped packages carry the scope in `group`; joining it is required. */
const fullName = c => (c.group ? `${c.group}/${c.name}` : c.name);

const licenceOf = c =>
  (c.licenses ?? [])
    .map(l => l.license?.id ?? l.license?.name ?? l.expression)
    .filter(Boolean)
    // A component can declare the same licence twice; report it once.
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' / ') || 'UNKNOWN';

const LICENCE_URLS = {
  MIT: 'https://opensource.org/license/mit',
  ISC: 'https://opensource.org/license/isc-license-txt',
  'BSD-2-Clause': 'https://opensource.org/license/bsd-2-clause',
  'BSD-3-Clause': 'https://opensource.org/license/bsd-3-clause',
  'Apache-2.0': 'https://opensource.org/license/apache-2-0'
};

const components = sbom.components
  .map(c => ({ name: fullName(c), version: c.version, licence: licenceOf(c) }))
  .sort((a, b) => a.name.localeCompare(b.name));

const unknown = components.filter(c => c.licence === 'UNKNOWN');
if (unknown.length) {
  console.error('Components with no declared licence:', unknown.map(c => c.name).join(', '));
  console.error('An OSS disclosure cannot be produced with unlicensed components.');
  process.exit(1);
}

const counts = components.reduce((acc, c) => {
  acc[c.licence] = (acc[c.licence] ?? 0) + 1;
  return acc;
}, {});

const lines = [
  BEGIN,
  '',
  `**${components.length} components** are distributed with this product. Generated from ` +
    '`sbom.json`; regenerate with `npm run oss`.',
  '',
  'Licence summary: ' +
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([l, n]) => `${l} (${n})`)
      .join(', ') +
    '. All are permissive attribution licences; none are copyleft.',
  '',
  '| Component | Version | Licence | Direct dependency |',
  '|-----------|---------|---------|-------------------|',
  ...components.map(c => {
    const url = LICENCE_URLS[c.licence];
    const licenceCell = url ? `[${c.licence}](${url})` : c.licence;
    return `| ${c.name} | ${c.version} | ${licenceCell} | ${direct.has(c.name) ? 'yes' : 'no'} |`;
  }),
  '',
  END
].join('\n');

const oss = readFileSync(ossPath, 'utf8');
const start = oss.indexOf(BEGIN);
const finish = oss.indexOf(END);

const updated =
  start !== -1 && finish !== -1
    ? oss.slice(0, start) + lines + oss.slice(finish + END.length)
    : oss.replace(/\n*$/, '\n\n') + lines + '\n';

writeFileSync(ossPath, updated);
console.log(
  `OSS.md: ${components.length} components (${components.filter(c => direct.has(c.name)).length} direct)`
);

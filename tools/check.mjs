// Runs Shopify's theme linter (theme-check) on the theme and prints any offenses.
import path from 'path';
import * as tc from '@shopify/theme-check-node';

const root = path.resolve(process.argv[2] ?? '.');
const result = await tc.themeCheckRun(root, undefined, () => {});
const offenses = result.offenses ?? result;
for (const o of offenses) {
  const sev = ['ERROR', 'WARN', 'INFO'][o.severity] ?? o.severity;
  console.log(`${sev} ${path.relative(root, new URL(o.uri).pathname)}:${o.start?.line + 1} [${o.check}] ${o.message}`);
}
console.log(`${offenses.length} offense(s)`);
process.exit(offenses.some((o) => o.severity === 0) ? 1 : 0);

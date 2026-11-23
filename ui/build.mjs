// Builds the two Custom UI resources into static/build/{panel,log}. With --preview, @forge/bridge is swapped for a
// local fake so the pages can be opened and screenshotted outside Jira.
import { build } from 'esbuild';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';

const preview = process.argv.includes('--preview');
const out = preview ? 'static/preview' : 'static/build';
for (const page of ['panel', 'log']) {
  const dir = `${out}/${page}`;
  mkdirSync(dir, { recursive: true });
  await build({
    entryPoints: [`ui/${page}.ts`],
    bundle: true,
    minify: !preview,
    format: 'iife',
    target: 'es2020',
    outfile: `${dir}/app.js`,
    alias: preview ? { '@forge/bridge': './ui/preview-bridge.ts' } : {},
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  cpSync('ui/theme.css', `${dir}/theme.css`);
  cpSync('ui/fonts', `${dir}/fonts`, { recursive: true });
  writeFileSync(`${dir}/index.html`, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page === 'panel' ? 'Verdict' : 'Verdict Log'}</title>
<link rel="stylesheet" href="theme.css">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`);
}
console.log(`built ${out}`);

import {readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, statSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRadar, type Snapshot} from './lib/model.ts';
import {buildDossier} from './vendor/makefun-board.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
function option(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  if (index >= 0) {
    if (!args[index+1]) throw new Error(`Missing --${name} value`);
    return args[index+1];
  }
  return args.find(a => a.startsWith(`--${name}=`))?.slice(name.length+3) ?? fallback;
}
let input = resolve(option('input', '/input/snapshot.json'));
if (statSync(input).isDirectory()) input = join(input, 'snapshot.json');
const snapshot = JSON.parse(readFileSync(input,'utf8')) as Snapshot;
const radar = buildRadar(snapshot);
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
mkdirSync(out, {recursive:true});
writeFileSync(join(out,'board.json'), JSON.stringify({rows:radar.rows})+'\n');
// Full row objects are shared with board.json; the UI does not recalculate scores or plans.
writeFileSync(join(out,'data.js'), 'window.RADAR = '+JSON.stringify(radar).replace(/</g,'\\u003c')+';\n');
for (const dir of ['dashboard','screenshots']) {
  mkdirSync(join(out,dir), {recursive:true});
  if (existsSync(join(root,dir))) cpSync(join(root,dir),join(out,dir),{recursive:true});
}
console.log(`Radar: ${radar.rows.length} rows; ${radar.watchlist_size}/${snapshot.watchlist.length} watchlist; ${radar.early_size} below-floor candidates; ${radar.live.length} live tokens separate.`);
console.log(`Median market-cap/TVL: ${radar.market_multiple} from ${radar.market_sample_size} positive samples.`);
console.log(JSON.stringify(radar.rows.slice(0,5).map(r => ({slug:r.slug, implied_value_usd:r.implied_value_usd}))));
// A development run can prepare data before screenshots exist. Final runs always build the dossier.
if (existsSync(join(out,'dashboard','index.html')) && existsSync(join(out,'screenshots')) && readdirSync(join(out,'screenshots')).length >= 3) {
  writeFileSync(join(out,'dossier.json'), buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}}));
  console.log('Dossier regenerated.');
} else console.log('Development output ready; dashboard and three screenshots required to build dossier.');

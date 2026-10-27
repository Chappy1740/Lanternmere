/* eslint-disable no-console -- Local synthetic preview address. */
// Local, synthetic UI fixture. No authenticated routes, API calls or stored data.
// Run after npm run build: node tests/weekly-progress/preview.mjs
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, '.next/weekly-progress-preview');
await mkdir(output, { recursive: true });
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {GuildWeeklyProgressBoard} from './src/components/guild-weekly-progress-board';
import {WeeklyRequirementForm,WeeklyReportForm} from './src/components/guild-weekly-progress-forms';
import {buildProgressRows} from './src/lib/weekly-raider-progress';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const target={id:id(90),mythic_runs_required:8,minimum_key_level:10,raid_bosses_required:null,updated_at:'2026-10-26T17:00:00Z'};
const members=[1,2,3,4].map(n=>({id:id(n),profile_id:id(n+10),name:'Example member '+n}));
const characters=members.slice(0,3).map((m,i)=>({id:id(i+30),profile_id:m.profile_id,character_name:['Wren','Ember','Briar'][i],realm_slug:'example-realm',region:'us',class:['Rogue','Priest','Druid'][i],character_snapshots:[{source:'blizzard',last_refreshed_at:'2026-10-26T16:00:00Z',snapshot_data:{equipped_item_level:[328,325,320][i],equipment:[{slot:'Head',name:'Example raid helm',item_level:334,enchantments:[],sockets:['Example gem']},{slot:'Chest',name:'Example raid armor',item_level:328,enchantments:['Example enchant'],sockets:[]}],raid_encounters:[{raid:'Example raid',difficulty:'Heroic',boss:'Example boss',last_kill_at:'2026-10-25T17:00:00Z'}],weekly_mythic_runs:[{level:10,dungeon:'Example dungeon',completedAt:'2026-10-25T17:00:00Z'}]}}]}));
const reports=characters.map((c,i)=>({id:id(i+50),character_id:c.id,reset_on:'2026-10-27',mythic_run_levels:Array([6,8,3][i]).fill(10),weekly_raid_bosses:[6,8,2][i],raid_vault_slots:[2,3,1][i],dungeon_vault_slots:[2,3,1][i],world_vault_slots:null,reported_at:i===2?'2026-10-24T17:00:00Z':'2026-10-26T17:00:00Z'}));
const rows=buildProgressRows({members,characters,reports,requirement:target,selection:null,region:'us',resetOn:'2026-10-27',weekStartsAt:'2026-10-20T15:00:00Z',weekEndsAt:'2026-10-27T15:00:00Z',now:Date.parse('2026-10-26T18:00:00Z')});
createRoot(document.getElementById('root')).render(<main className="mx-auto w-full min-w-0 max-w-7xl space-y-6 p-4 sm:p-8">
<header className="lodge-panel p-5 sm:p-8"><p className="lodge-kicker">Lanternmere · Synthetic local preview</p><h1 className="font-display text-text-primary mt-2 text-3xl font-bold">Raid team: weekly progress</h1><p className="text-text-secondary mt-3">Example roster · North America · Week ending October 27</p><p className="text-text-muted mt-2 text-sm">Fictional data. These controls do not save or contact any account.</p></header>
<WeeklyRequirementForm guildId={id(99)} operationId={null} region="us" resetOn="2026-10-27" requirement={target}/>
<GuildWeeklyProgressBoard rows={rows} requirement={target}/>
<WeeklyReportForm guildId={id(99)} guildName="Example Guild" characterId={characters[0].id} characterName="Wren" resetOn="2026-10-27" report={reports[0]} shared={true} characterShared={true}/>
</main>);
`;
await build({
  stdin: { contents: entry, resolveDir: root, loader: 'jsx' },
  bundle: true,
  outfile: path.join(output, 'preview.js'),
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [
    {
      name: 'synthetic-actions',
      setup(builder) {
        builder.onResolve({ filter: /guild-hall\/progress\/actions$/ }, () => ({
          path: 'actions',
          namespace: 'fixture',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
          contents:
            'export async function saveWeeklyReport(){return {error:false,message:"Preview only. Nothing was saved."}}; export const saveWeeklyRequirement=saveWeeklyReport;',
        }));
      },
    },
  ],
});
const chunks = path.join(root, '.next/static/chunks');
const styles = (
  await Promise.all(
    (await readdir(chunks))
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFile(path.join(chunks, file), 'utf8')),
  )
).join('\n');
const html =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lanternmere weekly progress — synthetic local fixture</title><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>';
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const routes = {
    '/': ['text/html', html],
    '/preview.css': ['text/css', styles],
    '/preview.js': ['text/javascript', await readFile(path.join(output, 'preview.js'))],
  };
  const route = routes[pathname];
  response.writeHead(route ? 200 : 404, {
    'Content-Type': route?.[0] ?? 'text/plain',
    'Cache-Control': 'no-store',
  });
  response.end(route?.[1] ?? 'Not found');
});
server.listen(4318, '127.0.0.1', () =>
  console.log('Synthetic weekly progress preview: http://127.0.0.1:4318'),
);

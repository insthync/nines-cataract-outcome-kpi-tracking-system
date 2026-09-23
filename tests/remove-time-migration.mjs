// Populated upgrade test using only a fresh OS temporary database.
import {mkdtempSync,mkdirSync,copyFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=mkdtempSync(join(tmpdir(),'cataract-remove-time-'));
const migrations=join(temp,'migrations'),hooks=join(temp,'hooks');
const migration='1790120000_remove_surgery_time.js';
function run(){
  const result=spawnSync(join(root,'pocketbase',process.platform==='win32'?'pocketbase.exe':'pocketbase'),['migrate','up',`--dir=${join(temp,'data')}`,`--migrationsDir=${migrations}`,`--hooksDir=${hooks}`],{encoding:'utf8',windowsHide:true});
  if(result.status!==0||/^Error:/m.test(result.stdout+result.stderr))throw new Error(result.stdout+result.stderr);
}
try{
  mkdirSync(migrations);mkdirSync(hooks);
  for(const file of readdirSync(join(root,'pocketbase/pb_migrations')).filter(f=>f.endsWith('.js')&&f<migration))copyFileSync(join(root,'pocketbase/pb_migrations',file),join(migrations,file));
  writeFileSync(join(migrations,'1790119999_test_fixture.js'),`migrate((app)=>{
    const r=new Record(app.findCollectionByNameOrId('cases'));
    r.load({hn:'MIGRATION-ONLY',patient_name:'Synthetic test only',surgery_date:'2026-01-01',surgeon:'Test',procedure:'Phaco',eye:'OD',surgery_time:'09:05',implant:'Test +21D',lens_type:'Monofocal IOL',revision:1});app.save(r);
  });`);
  run();
  copyFileSync(join(root,'pocketbase/pb_migrations',migration),join(migrations,migration));
  writeFileSync(join(migrations,'1790120001_test_assert.js'),`migrate((app)=>{
    const records=app.findRecordsByFilter('cases','hn = "MIGRATION-ONLY"','',1,0),r=records[0];
    if(records.length!==1||r.getString('implant')!=='Test +21D'||r.getString('lens_type')!=='Monofocal IOL')throw new Error('Other case data changed');
    const columns=arrayOf(new DynamicModel({name:''}));app.db().newQuery('PRAGMA table_info(cases)').all(columns);
    if(columns.some(c=>c.name==='surgery_time'))throw new Error('SQLite surgery_time column still exists');
  });`);
  run();run();
  console.log('PASS: populated upgrade removes SQLite time column, preserves case/lens data, and is idempotent.');
}finally{rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});}

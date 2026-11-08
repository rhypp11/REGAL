const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {buildRelease}=require('../scripts/build-release.cjs');
test('release numbering follows Paris build day and only changes for runtime changes',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'regal-release-'));
 try {
  await fs.writeFile(path.join(directory,'release-config.json'),'{"major":3}');
  await fs.writeFile(path.join(directory,'index.html'),'<meta name="regal-version" content=""><meta name="regal-build" content=""><h1>REGAL</h1>');
  await fs.writeFile(path.join(directory,'app.js'),'const app=1;');
  const first=await buildRelease({directory,date:'2026-11-08'});
  assert.equal(first.version,'3_08.11.26-1');
  assert.equal((await buildRelease({directory,date:'2026-11-08'})).version,first.version,'Same content does not create phantom releases');
  assert.equal((await buildRelease({directory,date:'2026-11-09'})).version,first.version,'Time alone is not a new build');
  await buildRelease({directory,check:true});
  await fs.writeFile(path.join(directory,'app.js'),'const app=2;');
  await assert.rejects(buildRelease({directory,check:true}),/stale/);
  const second=await buildRelease({directory,date:'2026-11-08'});assert.equal(second.version,'3_08.11.26-2');assert.notEqual(second.build,first.build);
  await fs.writeFile(path.join(directory,'app.js'),'const app=3;');
  assert.equal((await buildRelease({directory,date:'2026-11-09'})).version,'3_09.11.26-1');
  await fs.writeFile(path.join(directory,'release-config.json'),'{"major":4}');
  assert.equal((await buildRelease({directory,date:'2026-11-09'})).version,'4_09.11.26-1');
  await buildRelease({directory,check:true});
 }finally{
  assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'regal-release-'));
  await fs.rm(directory,{recursive:true,force:true});
 }
});

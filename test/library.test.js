import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createStore } from '../src/store.js';
import { createApp } from '../src/server.js';
import { suggestTags } from '../src/ai.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+VsAAAAASUVORK5CYII=', 'base64');
const PNG2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
function removeFixture(directory) {
  if (!resolve(directory).startsWith(join(resolve(tmpdir()), 'framevault-'))) throw new Error('Unexpected fixture path');
  rmSync(directory,{recursive:true,force:true});
}
function body(bytes=PNG) { return { title:'Mira 的外套', project:'夜航', character:'Mira', type:'outfit', tags:['紫色','外套'], filename:'mira.png', data:`data:image/png;base64,${bytes.toString('base64')}` }; }
function storeFixture(t) {
  const directory=mkdtempSync(join(tmpdir(),'framevault-store-'));
  const store=createStore(directory);
  t.after(()=>{store.close();removeFixture(directory);});
  return {store,directory};
}
async function appFixture(t,options={}) {
  const directory=mkdtempSync(join(tmpdir(),'framevault-api-'));
  const app=createApp({dataDir:directory,...options});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>{app.server.close(resolve);app.server.closeAllConnections();});app.store.close();removeFixture(directory);});
  async function request(path,method='GET',data,headers={}) {
    return fetch(`${base}${path}`,{method,headers:{'content-type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)});
  }
  return {...app,base,request};
}

test('a new version keeps original bytes, resets approval and assigns a stable sequence',t=>{
  const {store}=storeFixture(t);
  const asset=store.create(body());
  store.update(asset.id,{status:'approved'});
  const next=store.addVersion(asset.id,{...body(PNG2),changelog:'修改领口'});
  assert.equal(next.status,'draft');
  assert.deepEqual(next.versions.map(v=>v.number),[2,1]);
  assert.equal(next.versions[1].sha256,createHash('sha256').update(PNG).digest('hex'));
  assert.deepEqual(readFileSync(join(store.media,next.versions[1].media_path)),PNG);
  assert.deepEqual(readFileSync(join(store.media,next.latest.media_path)),PNG2);
});
test('duplicate imports and duplicate versions do not mutate the library',t=>{
  const {store}=storeFixture(t);
  const asset=store.create(body());
  assert.throws(()=>store.create(body()),{status:409});
  assert.throws(()=>store.addVersion(asset.id,body()),{status:409});
  assert.equal(store.list().length,1);
  assert.equal(store.get(asset.id).versions.length,1);
});
test('metadata changes, Chinese search and filtered manifest share the same semantics',t=>{
  const {store}=storeFixture(t);
  const asset=store.create(body());
  store.update(asset.id,{status:'approved',tags:['外套','外套','学院风']});
  assert.equal(store.list({q:'学院风',project:'夜航',type:'outfit',status:'approved'}).length,1);
  assert.equal(store.list({status:'review'}).length,0);
  const exported=store.manifest({status:'approved'});
  assert.equal(exported.schema,'framevault.manifest.v1');
  assert.deepEqual(exported.assets[0].tags,['外套','学院风']);
  assert.equal(exported.assets[0].versions[0].filename,'mira.png');
});
test('invalid metadata and spoofed images are rejected before insertion',t=>{
  const {store}=storeFixture(t);
  assert.throws(()=>store.create({...body(),status:'published'}),{status:400});
  assert.throws(()=>store.create({...body(),title:' '}),{status:400});
  assert.throws(()=>store.create({...body(),data:'data:image/png;base64,PHNjcmlwdD4='}),{status:400});
  assert.throws(()=>store.create({...body(),data:'data:image/svg+xml;base64,PHN2Zz4='}),{status:400});
  assert.equal(store.list().length,0);
});
test('library survives reopen with approval, versions and hashes intact',t=>{
  const directory=mkdtempSync(join(tmpdir(),'framevault-persist-'));
  let second;
  t.after(()=>{second?.close();removeFixture(directory);});
  const first=createStore(directory);const asset=first.create(body());first.update(asset.id,{status:'approved'});first.close();
  second=createStore(directory);
  assert.equal(second.get(asset.id).status,'approved');
  assert.equal(second.get(asset.id).latest.sha256,createHash('sha256').update(PNG).digest('hex'));
});
test('demo assets are original, repeat seeding is refused and hashes match actual SVG bytes',t=>{
  const {store}=storeFixture(t);
  const samples=store.seed();assert.equal(samples.length,6);
  const demo=samples.find(a=>a.latest.filename==='moon.svg');
  const bytes=readFileSync(new URL('../public/demo/moon.svg',import.meta.url));
  assert.equal(demo.latest.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(demo.latest.bytes,bytes.length);
  assert.throws(()=>store.seed(),{status:409});
});
test('HTTP import, update, media fetch and download manifest work end to end',async t=>{
  const {request,base}=await appFixture(t);
  const created=await request('/api/assets','POST',body());assert.equal(created.status,201);
  const asset=await created.json();
  const edited=await request(`/api/assets/${asset.id}`,'PATCH',{status:'approved'});assert.equal(edited.status,200);
  const search=await (await request('/api/assets?q=Mira&status=approved')).json();assert.equal(search.assets.length,1);
  const media=await fetch(base+asset.latest.url);assert.equal(media.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await media.arrayBuffer()),PNG);
  const exported=await request('/api/manifest?status=approved');assert.match(exported.headers.get('content-disposition'),/attachment/);
  assert.equal((await exported.json()).assets.length,1);
});
test('HTTP rejects cross-origin mutations, invalid hosts, malformed JSON and traversal',async t=>{
  const {request,base}=await appFixture(t);
  assert.equal((await request('/api/assets','POST',body(),{origin:'https://attacker.example'})).status,403);
  assert.equal((await request('/api/assets','POST',body(),{'sec-fetch-site':'cross-site'})).status,403);
  const badHostStatus=await new Promise((resolve,reject)=>{
    const req=httpRequest(base+'/api/health',{headers:{host:'attacker.example:4317'}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);req.end();
  });
  assert.equal(badHostStatus,403);
  const malformed=await fetch(base+'/api/assets',{method:'POST',headers:{'content-type':'application/json'},body:'{broken'});
  assert.equal(malformed.status,400);
  assert.equal((await request('/media/%2e%2e%2f.env')).status,404);
  assert.equal((await request('/.env')).status,404);
  assert.equal((await request('/api/assets')).headers.get('x-content-type-options'),'nosniff');
});
test('unconfigured AI returns a useful error and health never leaks credentials',async t=>{
  const {request}=await appFixture(t,{ai:{base:'https://provider.example/v1',key:'',model:''}});
  const asset=await (await request('/api/assets','POST',body())).json();
  assert.equal((await request(`/api/assets/${asset.id}/suggest-tags`,'POST',{})).status,503);
  const health=await (await request('/api/health')).json();assert.equal(health.aiEnabled,false);assert.equal(health.aiProvider,null);
});
test('AI proposal validates model output and never silently writes tags or approval',async t=>{
  let payload;
  const fetcher=async(url,options)=>{
    payload=JSON.parse(options.body);assert.equal(url,'https://provider.example/v1/chat/completions');
    assert.equal(options.headers.authorization,'Bearer test-secret');
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({tags:['月光','紫色'],reason:'可见冷色调外套'})}}]}),{status:200});
  };
  const {request,store}=await appFixture(t,{ai:{base:'https://provider.example/v1',key:'test-secret',model:'test-vision'},fetcher});
  const asset=await (await request('/api/assets','POST',body())).json();
  const proposal=await (await request(`/api/assets/${asset.id}/suggest-tags`,'POST',{})).json();
  assert.deepEqual(proposal.tags,['月光','紫色']);
  assert.equal(payload.model,'test-vision');assert.match(payload.messages[1].content[1].image_url.url,/^data:image\/png;base64,/);
  assert.deepEqual(store.get(asset.id).tags,['紫色','外套']);assert.equal(store.get(asset.id).status,'draft');
  const health=JSON.stringify(await (await request('/api/health')).json());assert.ok(!health.includes('test-secret'));
});
test('bad AI results, failures and insecure remote endpoints return bounded errors',async t=>{
  const {store}=storeFixture(t);const asset=store.create(body());
  const config={base:'https://provider.example/v1',key:'secret',model:'test'};
  await assert.rejects(suggestTags(asset,store.media,config,async()=>new Response(JSON.stringify({choices:[{message:{content:'not json'}}]}))),{status:502});
  await assert.rejects(suggestTags(asset,store.media,config,async()=>new Response('quota',{status:429})),{status:502});
  await assert.rejects(suggestTags(asset,store.media,config,async()=>{throw new Error('network');}),{status:502});
  await assert.rejects(suggestTags(asset,store.media,{...config,base:'http://remote.example/v1'}),{status:503});
});
test('concurrent AI requests for the same asset are rejected and lock is released',async t=>{
  let release;let started;
  const start=new Promise(resolve=>{started=resolve;});
  const gate=new Promise(resolve=>{release=resolve;});
  const fetcher=async()=>{started();await gate;return new Response(JSON.stringify({choices:[{message:{content:'{"tags":["紫色"],"reason":"色彩"}'}}]}));};
  const {request}=await appFixture(t,{ai:{base:'https://provider.example/v1',key:'secret',model:'test'},fetcher});
  const asset=await (await request('/api/assets','POST',body())).json();
  const first=request(`/api/assets/${asset.id}/suggest-tags`,'POST',{});await start;
  assert.equal((await request(`/api/assets/${asset.id}/suggest-tags`,'POST',{})).status,409);
  release();assert.equal((await first).status,200);
  assert.equal((await request(`/api/assets/${asset.id}/suggest-tags`,'POST',{})).status,200);
});

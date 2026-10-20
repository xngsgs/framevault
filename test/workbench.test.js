import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importItems, importSummary, runImportQueue, selectAssets, projectSummary, popularTags, reconcileSelection } from '../public/library.js';

const file = (name, type = 'image/png', size = 10) => ({ name, type, size });

test('refreshing a collection clears changed-image selections instead of approving unseen versions', () => {
  const selected = new Map([['a','old-image'],['b','same-image'],['hidden','hidden-image']]);
  const changed = reconcileSelection(selected,[{id:'a',latest:{id:'new-image'}},{id:'b',latest:{id:'same-image'}}]);
  assert.equal(changed,1);
  assert.deepEqual([...selected],[['b','same-image']]);
  assert.equal(reconcileSelection(selected,[{id:'b',project:'changed metadata',latest:{id:'same-image'}}]),0);
  assert.equal(selected.get('b'),'same-image');
});

test('batch import reports per-image failures, continues, and retries only failed items', async () => {
  const queue = importItems([file('角色.png'), file('背景.png'), file('不支持.txt', 'text/plain'), file('超限.png','image/png',11*1024*1024)]);
  const calls = [];
  await runImportQueue(queue, { upload: async item => { calls.push(item.file.name); if (item.id === 1) throw new Error('连接中断'); return {id:'saved'}; } });
  assert.deepEqual(calls, ['角色.png','背景.png']);
  assert.deepEqual(importSummary(queue), {done:1,failed:1,invalid:2,pending:0,uploading:0});
  assert.equal(queue[1].error, '连接中断');
  queue[1].status = 'pending';
  await runImportQueue(queue, {upload: async item => { calls.push(item.file.name); return {id:'retry-saved'}; }});
  assert.deepEqual(calls, ['角色.png','背景.png','背景.png']);
  assert.equal(queue[0].asset.id, 'saved');
  assert.equal(queue[1].asset.id, 'retry-saved');
  assert.equal(queue[1].error, '');
  assert.equal(importSummary(queue).done, 2);
});

test('pausing a queue preserves the current save and leaves later images pending', async () => {
  const queue = importItems([file('1.png'),file('2.png'),file('3.png')]);
  let stopped = false;
  await runImportQueue(queue, { shouldStop: () => stopped, upload: async item => { stopped = true; return {id:item.id}; } });
  assert.deepEqual(queue.map(i=>i.status), ['done','pending','pending']);
  await runImportQueue(queue, {upload:async item=>({id:item.id})});
  assert.equal(importSummary(queue).done, 3);
});

test('batch selection bounds and invalid files are rejected before upload', () => {
  assert.throws(()=>importItems([]), /1–20/);
  assert.throws(()=>importItems(Array.from({length:21},()=>file('x.png'))), /1–20/);
  const queue = importItems([file('empty.png','image/png',0),file('.png'),file('a'.repeat(150)+'.png')]);
  assert.equal(queue[0].status, 'invalid');
  assert.equal(queue[1].title, '未命名素材');
  assert.equal(queue[2].title.length, 120);
});

test('collection sorting, project readiness and exact tags reflect actual records without mutation', () => {
  const assets = [
    {id:'a',title:'旧图',project:'夜航',character:'Mira',type:'outfit',status:'approved',tags:['紫色','外套'],notes:'',created_at:'2026-01-01',updated_at:'2026-01-01'},
    {id:'b',title:'新图',project:'夏日',character:'',type:'background',status:'review',tags:['紫色外套'],notes:'',created_at:'2026-02-01',updated_at:'2026-03-01'},
    {id:'c',title:'修改图',project:'夜航',character:'Mira',type:'outfit',status:'draft',tags:['紫色'],notes:'',created_at:'2026-01-02',updated_at:'2026-02-01'}
  ];
  assert.deepEqual(selectAssets(assets).map(a=>a.id), ['b','c','a']);
  assert.deepEqual(selectAssets(assets,{tag:'紫色',query:' mira ',project:'夜航'}).map(a=>a.id), ['c','a']);
  assert.deepEqual(selectAssets(assets,{sort:'oldest'}).map(a=>a.id), ['a','c','b']);
  assert.deepEqual(assets.map(a=>a.id), ['a','b','c']);
  const projects = projectSummary(assets);
  assert.equal(projects.find(p=>p.name==='夜航').approved, 1);
  assert.equal(projects.find(p=>p.name==='夏日').review, 1);
  assert.deepEqual(popularTags(assets)[0], ['紫色',2]);
});

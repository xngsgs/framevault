import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { HttpError, metadata, image, text, STATUSES } from './validation.js';

export function createStore(directory) {
  const media = join(directory, 'media');
  mkdirSync(media, { recursive: true });
  const db = new DatabaseSync(join(directory, 'library.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, project TEXT NOT NULL,
      character TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
      tags TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id),
      number INTEGER NOT NULL, filename TEXT NOT NULL, media_path TEXT NOT NULL,
      sha256 TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
      changelog TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(asset_id, number)
    );
    CREATE INDEX IF NOT EXISTS versions_asset ON versions(asset_id);
    CREATE INDEX IF NOT EXISTS versions_hash ON versions(sha256);
    PRAGMA user_version=1;`);

  const publicVersion = v => ({ ...v, url: v.media_path.startsWith('demo:') ? `/demo/${v.media_path.slice(5)}.svg` : `/media/${v.media_path}` });
  function get(id) {
    const row = db.prepare('SELECT * FROM assets WHERE id=?').get(id);
    if (!row) throw new HttpError(404, 'Asset not found');
    const versions = db.prepare('SELECT * FROM versions WHERE asset_id=? ORDER BY number DESC').all(id).map(publicVersion);
    return { ...row, tags: JSON.parse(row.tags), versions, latest: versions[0] };
  }
  function list({ q = '', project = '', type = '', status = '', tag = '' } = {}) {
    const rows = db.prepare('SELECT id FROM assets ORDER BY updated_at DESC, id ASC').all();
    const needle = q.toLocaleLowerCase();
    return rows.map(row => get(row.id)).filter(a =>
      (!project || a.project === project) && (!type || a.type === type) && (!status || a.status === status) && (!tag || a.tags.includes(tag)) &&
      (!needle || [a.title, a.project, a.character, a.notes, ...a.tags].join(' ').toLocaleLowerCase().includes(needle)));
  }
  function duplicate(hash, assetId) {
    if (assetId) return db.prepare('SELECT id FROM versions WHERE sha256=? AND asset_id=?').get(hash, assetId);
    return db.prepare('SELECT asset_id FROM versions WHERE sha256=?').get(hash);
  }
  function insertVersion(id, data, changelog = '') {
    const upload = image(data);
    const hash = createHash('sha256').update(upload.bytes).digest('hex');
    if (duplicate(hash, id)) throw new HttpError(409, 'This image already exists in this asset');
    const filename = `${hash}.${upload.extension}`;
    const path = join(media, filename);
    // Content-addressed files are immutable. DB transactions make version numbers atomic.
    if (!existsSync(path)) writeFileSync(path, upload.bytes, { flag: 'wx' });
    const number = db.prepare('SELECT COALESCE(MAX(number),0)+1 AS n FROM versions WHERE asset_id=?').get(id).n;
    const now = new Date().toISOString();
    db.prepare('INSERT INTO versions VALUES (?,?,?,?,?,?,?,?,?,?)').run(
      randomUUID(), id, number, upload.name, filename, hash, upload.mime, upload.bytes.length,
      text(changelog, 'changelog', 1000), now);
    // A new image always needs a new review, even when the previous version was approved.
    db.prepare("UPDATE assets SET updated_at=?, status='draft' WHERE id=?").run(now, id);
  }
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function create(body) {
    const meta = metadata(body);
    const upload = image(body);
    const hash = createHash('sha256').update(upload.bytes).digest('hex');
    const existing = duplicate(hash);
    if (existing) throw new HttpError(409, `Duplicate image; existing asset: ${existing.asset_id}`);
    const id = randomUUID();
    transaction(() => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, meta.title, meta.project, meta.character, meta.type, 'draft', JSON.stringify(meta.tags), meta.notes, now, now);
      insertVersion(id, body, body.changelog);
    });
    return get(id);
  }
  function update(id, body) {
    const current = get(id);
    const meta = metadata({ ...current, ...body });
    db.prepare('UPDATE assets SET title=?,project=?,character=?,type=?,status=?,tags=?,notes=?,updated_at=? WHERE id=?').run(
      meta.title, meta.project, meta.character, meta.type, meta.status, JSON.stringify(meta.tags), meta.notes, new Date().toISOString(), id);
    return get(id);
  }
  function addVersion(id, body) {
    get(id);
    transaction(() => insertVersion(id, body, body.changelog));
    return get(id);
  }
  function updateMany(body) {
    if (!body || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100 ||
      body.ids.some(id => typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))) throw new HttpError(400, 'Select 1 to 100 assets');
    const changes = body.changes;
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length ||
      Object.keys(changes).some(key => !['status', 'project'].includes(key))) throw new HttpError(400, 'Only project and status can be changed in bulk');
    const patch = {};
    if ('status' in changes) {
      if (!STATUSES.includes(changes.status)) throw new HttpError(400, 'Unknown status');
      patch.status = changes.status;
    }
    if ('project' in changes) patch.project = text(changes.project, 'project', 100, true);
    if (!body.versions || typeof body.versions !== 'object' || Array.isArray(body.versions)) throw new HttpError(400, 'Expected image versions are required');
    const ids = [...new Set(body.ids)];
    return transaction(() => {
      // Validate the complete selection before changing any record. A newer image needs fresh human review.
      for (const id of ids) {
        const asset = get(id);
        if (body.versions[id] !== asset.latest.id) throw new HttpError(409, 'An image version changed; refresh the library and select again');
      }
      return ids.map(id => update(id, patch));
    });
  }
  function seed() {
    if (db.prepare('SELECT count(*) AS n FROM assets').get().n) throw new HttpError(409, 'Demo can only be loaded into an empty library');
    const samples = [
      ['夜航 · 角色概念', '夜航计划', 'Mira', 'character', 'approved', ['角色','概念','紫色','夜景'], 'portrait'],
      ['月面观测站', '夜航计划', '', 'background', 'approved', ['背景','科幻','蓝色','建筑'], 'moon'],
      ['信号灯 · 道具设定', '夜航计划', '', 'prop', 'review', ['道具','橙色','工业'], 'signal'],
      ['日落海岸', '夏日来信', '', 'background', 'draft', ['背景','海边','日落','暖色'], 'coast'],
      ['Mira · 外套方案', '夜航计划', 'Mira', 'outfit', 'review', ['服装','外套','紫色'], 'outfit'],
      ['玻璃花园', '夏日来信', '', 'reference', 'draft', ['参考','植物','绿色','建筑'], 'garden']
    ];
    transaction(() => samples.forEach(([title, project, character, type, status, tagList, art]) => {
      const id = randomUUID(); const now = new Date().toISOString();
      db.prepare('INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, title, project, character, type, status, JSON.stringify(tagList), 'FrameVault 原创矢量演示图，仅用于演示素材管理流程。', now, now);
      const artBytes = readFileSync(join(dirname(dirname(fileURLToPath(import.meta.url))), 'public', 'demo', `${art}.svg`));
      db.prepare('INSERT INTO versions VALUES (?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), id, 1, `${art}.svg`, `demo:${art}`, createHash('sha256').update(artBytes).digest('hex'), 'image/svg+xml', artBytes.length, '原创演示素材', now);
    }));
    return list();
  }
  function manifest(filters) {
    return { schema: 'framevault.manifest.v1', exported_at: new Date().toISOString(), assets: list(filters) };
  }
  return { db, media, get, list, create, update, updateMany, addVersion, seed, manifest, close: () => db.close() };
}

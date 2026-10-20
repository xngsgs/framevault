// Shared, DOM-free collection and import behavior. The server remains authoritative.
export function selectAssets(assets, { query = '', project = '', type = '', status = '', tag = '', sort = 'updated' } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return assets.filter(a => (!project || a.project === project) && (!type || a.type === type) &&
    (!status || a.status === status) && (!tag || a.tags.includes(tag)) &&
    (!needle || [a.title, a.project, a.character, a.notes, ...a.tags].join(' ').toLocaleLowerCase().includes(needle)))
    .sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title, 'zh-CN') || a.id.localeCompare(b.id);
      if (sort === 'oldest') return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
      return b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id);
    });
}

export function projectSummary(assets) {
  const projects = new Map();
  for (const asset of selectAssets(assets)) {
    if (!projects.has(asset.project)) projects.set(asset.project, { name: asset.project, assets: [], approved: 0, review: 0 });
    const project = projects.get(asset.project);
    project.assets.push(asset);
    if (asset.status === 'approved') project.approved++;
    if (asset.status === 'review') project.review++;
  }
  return [...projects.values()];
}

export function popularTags(assets, limit = 8) {
  const counts = new Map();
  assets.forEach(a => new Set(a.tags).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).slice(0, limit);
}

export function reconcileSelection(selection, visibleAssets) {
  const versions = new Map(visibleAssets.map(a => [a.id, a.latest.id]));
  let changed = 0;
  for (const [id, version] of selection) {
    if (versions.get(id) !== version) {
      if (versions.has(id)) changed++;
      selection.delete(id);
    }
  }
  return changed;
}

export function importItems(files) {
  if (!files.length || files.length > 20) throw new Error('每批请选择 1–20 张图片');
  return Array.from(files, (file, id) => {
    const error = !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ? '仅支持 PNG、JPEG、WebP' :
      !file.size ? '文件为空' : file.size > 10 * 1024 * 1024 ? '图片超过 10 MB' : '';
    return { id, file, title: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || '未命名素材', status: error ? 'invalid' : 'pending', error };
  });
}

export function importSummary(items) {
  return Object.fromEntries(['done', 'failed', 'invalid', 'pending', 'uploading'].map(status => [status, items.filter(i => i.status === status).length]));
}

export async function runImportQueue(items, { upload, onChange = () => {}, shouldStop = () => false }) {
  for (const item of items) {
    if (shouldStop()) break;
    if (item.status !== 'pending') continue;
    item.status = 'uploading'; item.error = ''; onChange(item);
    try { item.asset = await upload(item); item.status = 'done'; }
    catch (error) { item.status = 'failed'; item.error = error.message || '导入失败，请重试'; }
    onChange(item);
  }
  return importSummary(items);
}

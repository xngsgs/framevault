const $ = selector => document.querySelector(selector);
const TYPE = { character: '角色概念', outfit: '服装方案', background: '场景背景', prop: '道具设定', reference: '参考资料' };
const STATUS = { draft: '草稿', review: '待审核', approved: '已确认', archived: '已归档' };
const TYPE_ICON = { character:'user', outfit:'shirt', background:'image', prop:'gem', reference:'book' };
const state = { assets: [], type: '', project: '', query: '', status: '', selected: null, proposal: null, versionTarget: null, health: {}, detailPanel:'metadata', detailsRequest:0 };
let toastTimer;
let previewUrl;

function node(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content !== undefined) el.textContent = content;
  return el;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','icon'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');
  const use = document.createElementNS('http://www.w3.org/2000/svg','use');
  use.setAttribute('href',`#i-${name}`); svg.append(use); return svg;
}
function preference(key, fallback, choices) {
  try { const value = localStorage.getItem(`framevault.${key}`); return choices.includes(value) ? value : fallback; }
  catch { return fallback; }
}
function remember(key, value) { try { localStorage.setItem(`framevault.${key}`,value); } catch { /* Private browsing still supports all library operations. */ } }
function setTheme(theme) {
  // Apply the palette together so controls never flash with mismatched text/background colors.
  document.documentElement.classList.add('theme-changing');
  document.documentElement.dataset.theme = theme;
  const next = theme === 'light' ? '深色' : '浅色';
  $('#theme-toggle').setAttribute('aria-label',`切换${next}主题`);
  $('#theme-toggle').title = `切换${next}主题`;
  $('#theme-toggle').replaceChildren(icon(theme === 'light' ? 'moon' : 'sun'));
  remember('theme',theme);
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.documentElement.classList.remove('theme-changing')));
}
function setView(view) {
  $('#asset-grid').classList.toggle('list',view === 'list');
  for (const name of ['gallery','list']) {
    $(`#${name}-view`).setAttribute('aria-pressed',String(view === name));
    $(`#${name}-view`).classList.toggle('active',view === name);
  }
  remember('view',view);
}
function toast(message, kind = 'success') {
  $('#toast').textContent = message;
  $('#toast').classList.toggle('error',kind === 'error');
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json' }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '请求失败');
  return body;
}
function tagList(items) {
  const list = node('div', 'tag-list');
  items.forEach(tag => list.append(node('span', 'tag', tag)));
  return list;
}
function date(value) { return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }); }
function filters() {
  return new URLSearchParams({ q: state.query.trim(), project: state.project, type: state.type, status: state.status });
}
function filtered(status = state.status) {
  const needle = state.query.trim().toLocaleLowerCase();
  const items = state.assets.filter(a => (!state.type || a.type === state.type) && (!state.project || a.project === state.project) && (!status || a.status === status) &&
    (!needle || [a.title, a.project, a.character, a.notes, ...a.tags].join(' ').toLocaleLowerCase().includes(needle)));
  if ($('#sort').value === 'name') items.sort((a,b) => a.title.localeCompare(b.title, 'zh-CN'));
  if ($('#sort').value === 'oldest') items.sort((a,b) => a.created_at.localeCompare(b.created_at));
  return items;
}
function card(asset) {
  const button = node('button', 'asset-card');
  button.type = 'button';
  button.setAttribute('aria-label', `查看 ${asset.title}，${STATUS[asset.status]}，版本 ${asset.latest.number}`);
  const picture = node('div', 'card-image');
  const img = node('img'); img.src = asset.latest.url; img.alt = asset.title; img.loading = 'lazy';
  const open = node('span','card-open','打开详情'); open.append(icon('arrow'));
  picture.append(img, node('span', `card-status ${asset.status}`, STATUS[asset.status]), node('span', 'card-version', `v${asset.latest.number}`), open);
  const content = node('div', 'card-content');
  const title = node('div','card-title-line'); title.append(node('h3','card-title',asset.title),icon('arrow'));
  content.append(title, node('p', 'card-subtitle', `${asset.project}${asset.character ? ' / ' + asset.character : ''}`), tagList(asset.tags.slice(0,4)));
  const foot = node('div', 'card-foot');
  const type = node('span','type-name'); type.append(icon(TYPE_ICON[asset.type]),document.createTextNode(TYPE[asset.type]));
  foot.append(type, node('span', '', `${date(asset.updated_at)} 更新`)); content.append(foot);
  button.append(picture, content);
  button.addEventListener('click', async () => { button.disabled = true; try { await showDetails(asset.id); } finally { button.disabled = false; } });
  return button;
}
function render() {
  const items = filtered();
  $('#asset-grid').replaceChildren(...items.map(card));
  $('#asset-grid').setAttribute('aria-busy','false');
  $('#loading').hidden = true;
  $('#result-count').textContent = items.length;
  $('#footer-count').textContent = `${items.length} 个素材${state.assets.length !== items.length ? ` / 共 ${state.assets.length} 个` : ''}`;
  $('#nav-total').textContent = state.assets.length;
  $('#stat-total').replaceChildren(document.createTextNode(state.assets.length), node('span','','项'));
  $('#stat-approved').replaceChildren(document.createTextNode(state.assets.filter(a => a.status === 'approved').length), node('span','','项'));
  $('#stat-review').replaceChildren(document.createTextNode(state.assets.filter(a => a.status === 'review').length), node('span','','项'));
  const projects = [...new Set(state.assets.map(a => a.project))].sort();
  $('#stat-projects').replaceChildren(document.createTextNode(projects.length), node('span','','个'));
  $('#projects-list').replaceChildren(...projects.map(project => { const option = node('option'); option.value = project; return option; }));
  const allProjects = node('option','','全部项目'); allProjects.value = '';
  $('#project-filter').replaceChildren(allProjects,...projects.map(project => { const option = node('option','',project); option.value = project; return option; }));
  $('#project-filter').value = state.project;
  $('#project-nav').replaceChildren(...projects.map(project => {
    const button = node('button', `nav-item project-item${project === state.project ? ' active' : ''}`);
    button.append(node('span','project-dot'), node('span','',project), node('span','nav-count',state.assets.filter(a => a.project === project).length));
    button.addEventListener('click', () => { state.project = state.project === project ? '' : project; render(); });
    return button;
  }));
  const title = state.project || TYPE[state.type] || '全部素材';
  $('#breadcrumb').textContent = title;
  $('#library-title').textContent = title;
  document.querySelectorAll('[data-type]').forEach(button => { button.classList.toggle('active', button.dataset.type === state.type); button.setAttribute('aria-pressed',String(button.dataset.type === state.type)); });
  document.querySelectorAll('[data-type-count]').forEach(el => { el.textContent = state.assets.filter(a=>a.type === el.dataset.typeCount).length; });
  const scope = filtered('');
  document.querySelectorAll('[data-status-count]').forEach(el => { el.textContent = el.dataset.statusCount === 'all' ? scope.length : scope.filter(a=>a.status === el.dataset.statusCount).length; });
  document.querySelectorAll('[data-status]').forEach(button => { button.classList.toggle('active',button.dataset.status === state.status); button.setAttribute('aria-pressed',String(button.dataset.status === state.status)); });
  const labels = { query:'搜索', project:'项目', type:'类型', status:'状态' };
  $('#active-filters').replaceChildren(...['query','project','type','status'].filter(key=>state[key]).map(key=>{
    const value = key === 'type' ? TYPE[state[key]] : key === 'status' ? STATUS[state[key]] : state[key];
    const chip = node('button','filter-chip',`${labels[key]}：${value}`); chip.setAttribute('aria-label',`清除${labels[key]}筛选`); chip.append(icon('close'));
    chip.addEventListener('click',()=>{ state[key]=''; if(key === 'query') $('#search').value=''; render(); }); return chip;
  }));
  $('#reset-filters').hidden = !['query','project','type','status'].some(key=>state[key]);
  $('#empty').hidden = items.length > 0;
  if (!items.length) {
    $('#empty h3').textContent = state.assets.length ? '这一组灵感，还没有找到。' : '给第一份灵感，留一个位置。';
    $('#empty .empty-copy').textContent = state.assets.length ? '试试其他关键词，或清除筛选，重新浏览你的收藏。' : '导入你自己的图片，或用原创示例探索这个工作空间。';
  }
  $('#load-demo').hidden = state.assets.length > 0;
  $('#empty-import').hidden = state.assets.length > 0;
  $('#empty-reset').hidden = state.assets.length === 0;
  $('#export').disabled = !items.length;
}
async function refresh() {
  const body = await api('/api/assets'); state.assets = body.assets; render();
}
function showVersion(asset, version) {
  $('#detail-image').src = version.url;
  $('#detail-image').alt = `${asset.title} · v${version.number}`;
  $('#detail-file').textContent = version.filename;
  $('#detail-version').textContent = `v${version.number}`;
  $('#preview-context').textContent = version.id === asset.latest.id ? `当前版本 · v${version.number}` : `历史版本 · v${version.number} / 最新版本 v${asset.latest.number}`;
  $('#download-image').href = version.url;
  $('#download-image').download = version.filename;
  document.querySelectorAll('.version-row').forEach(row => row.classList.toggle('active', row.dataset.id === version.id));
}
function showDetailPanel(name) {
  state.detailPanel = name;
  for (const panel of ['metadata','history']) {
    $(`#${panel}-panel`).hidden = panel !== name;
    $(`#${panel}-tab`).setAttribute('aria-selected',String(panel === name));
    $(`#${panel}-tab`).tabIndex = panel === name ? 0 : -1;
  }
}
function formValues(form) {
  const values = Object.fromEntries(new FormData(form));
  if (values.tags !== undefined) values.tags = values.tags.split(/[,，]/).map(t=>t.trim()).filter(Boolean);
  delete values.file;
  return values;
}
function fillDetails(asset) {
  if (state.selected?.id !== asset.id) state.detailPanel = 'metadata';
  state.selected = asset;
  state.proposal = null;
  $('#ai-proposal').hidden = true;
  $('#detail-error').textContent = '';
  $('#detail-title').textContent = asset.title;
  $('#detail-status').className = `status-badge ${asset.status}`;
  $('#detail-status').textContent = `最新 · ${STATUS[asset.status]}`;
  $('#version-count').textContent = asset.versions.length;
  showDetailPanel(state.detailPanel);
  const form = $('#detail-form');
  ['title','project','character','type','status','notes'].forEach(key => { form.elements[key].value = asset[key]; });
  form.elements.tags.value = asset.tags.join('，');
  $('#version-list').replaceChildren(...asset.versions.map(version => {
    const row = node('button','version-row'); row.type = 'button'; row.dataset.id = version.id;
    row.append(node('strong','',`v${version.number}`), node('span','',`${date(version.created_at)}${version.number === asset.latest.number ? ' · 当前版本' : ''}`), node('p','',version.changelog || version.filename));
    row.addEventListener('click', () => showVersion(asset,version));
    return row;
  }));
  showVersion(asset, asset.latest);
  $('#suggest-tags').disabled = !state.health.aiEnabled || asset.latest.media_path.startsWith('demo:');
  $('#ai-help').textContent = !state.health.aiEnabled ? 'AI 尚未配置。基础素材管理可直接使用，接入方法见 README。' : asset.latest.media_path.startsWith('demo:') ? '演示矢量图不发送给 AI，请先导入你自己的图片。' : '分析当前最新版本。建议先展示，确认后才写入标签。';
}
async function showDetails(id) {
  const request = ++state.detailsRequest;
  try { const asset = await api(`/api/assets/${id}`); if(request !== state.detailsRequest) return; fillDetails(asset); if(!$('#detail-dialog').open) $('#detail-dialog').showModal(); }
  catch(error) { toast(error.message,'error'); }
}
function openUpload(versionTarget = null) {
  state.versionTarget = versionTarget;
  const form = $('#upload-form'); form.reset();
  $('#upload-error').textContent = '';
  $('#upload-preview').hidden = true;
  $('#upload-file-name').hidden = true;
  $('#upload-preview').removeAttribute('src');
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  $('#upload-title').textContent = versionTarget ? '添加新版本' : '添加素材';
  $('#upload-submit').textContent = versionTarget ? '保存新版本' : '保存素材';
  $('#upload-dialog .modal-subtitle').textContent = versionTarget ? '保留之前的原图，记录这一次修改。' : '把新的灵感收进你的素材库。';
  $('#upload-metadata').hidden = !!versionTarget;
  // Hidden required inputs must not block version uploads.
  form.elements.title.required = !versionTarget;
  $('#changelog-label').hidden = !versionTarget;
  if (!versionTarget) form.elements.project.value = state.project;
  $('#upload-dialog').showModal();
}
function fileData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('无法读取图片')); reader.readAsDataURL(file);
  });
}
$('#upload-file').addEventListener('change', () => {
  const file = $('#upload-file').files[0];
  if (!file) return;
  $('#upload-error').textContent = '';
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    $('#upload-error').textContent = '请选择不超过 10 MB 的 PNG、JPEG 或 WebP 图片';
    $('#upload-file').value = ''; $('#upload-preview').hidden = true; $('#upload-file-name').hidden = true;
    if(previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; } return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  $('#upload-preview').src = previewUrl; $('#upload-preview').hidden = false;
  $('#upload-file-name').textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`; $('#upload-file-name').hidden = false;
  if (!state.versionTarget && !$('#upload-form').elements.title.value) $('#upload-form').elements.title.value = file.name.replace(/\.[^.]+$/,'').slice(0,120);
});
const drop = $('.upload-drop');
drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('dragging');});
drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
drop.addEventListener('drop',event=>{
  event.preventDefault(); drop.classList.remove('dragging');
  if(event.dataTransfer.files.length !== 1) { $('#upload-error').textContent = '请一次拖入一张图片'; return; }
  $('#upload-file').files = event.dataTransfer.files;
  $('#upload-file').dispatchEvent(new Event('change',{bubbles:true}));
});
$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#upload-submit'); button.disabled = true; $('#upload-error').textContent = '';
  try {
    const file = $('#upload-file').files[0];
    if (!file) throw new Error('请选择图片');
    if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB');
    const body = { ...formValues(event.target), filename:file.name, data:await fileData(file) };
    const asset = await api(state.versionTarget ? `/api/assets/${state.versionTarget}/versions` : '/api/assets', { method:'POST', body });
    $('#upload-dialog').close();
    await refresh();
    if (state.versionTarget) { fillDetails(asset); showDetailPanel('history'); }
    toast(state.versionTarget ? '新版本已保留，当前状态已重置为草稿' : '素材已加入本地库');
  } catch(error) { $('#upload-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#detail-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('[type="submit"]'); button.disabled = true;
  try { const asset = await api(`/api/assets/${state.selected.id}`, {method:'PATCH',body:formValues(event.target)}); fillDetails(asset); await refresh(); toast('修改已保存'); }
  catch(error) { $('#detail-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#suggest-tags').addEventListener('click', () => { $('#ai-destination').textContent = state.health.aiProvider; $('#ai-confirm-dialog').showModal(); });
$('#confirm-ai').addEventListener('click', async () => {
  $('#ai-confirm-dialog').close(); const button = $('#suggest-tags'); button.disabled = true; button.textContent = '分析中…'; $('#detail-error').textContent = '';
  const analyzedId = state.selected.id;
  const analyzedVersion = state.selected.latest.id;
  try {
    const proposal = await api(`/api/assets/${analyzedId}/suggest-tags`,{method:'POST',body:{}});
    if (state.selected.id !== analyzedId || state.selected.latest.id !== analyzedVersion) {
      toast('素材或版本已切换，请为当前图片重新生成建议'); return;
    }
    state.proposal = proposal; $('#ai-proposal').hidden = false;
    $('#suggested-tags').replaceChildren(tagList(proposal.tags)); $('#suggestion-reason').textContent = proposal.reason;
  } catch(error) { $('#detail-error').textContent = error.message; }
  finally { button.disabled = !state.health.aiEnabled || state.selected.latest.media_path.startsWith('demo:'); button.textContent = '分析图片'; }
});
$('#accept-tags').addEventListener('click', async () => {
  const button = $('#accept-tags'); button.disabled = true;
  try {
    const currentTags = formValues($('#detail-form')).tags;
    const nextTags = [...new Set([...currentTags,...state.proposal.tags])];
    const asset = await api(`/api/assets/${state.selected.id}`,{method:'PATCH',body:{tags:nextTags}});
    // Keep unrelated unsaved fields intact when accepting a tag proposal.
    state.selected = asset; $('#detail-form').elements.tags.value = asset.tags.join('，'); $('#ai-proposal').hidden = true;
    await refresh(); toast('AI 建议已确认并保存');
  } catch(error) { $('#detail-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#new-version').addEventListener('click',()=>openUpload(state.selected.id));
$('#add-asset').addEventListener('click',()=>openUpload());
$('#empty-import').addEventListener('click',()=>openUpload());
function resetFilters(status = '') { state.type=''; state.project=''; state.query=''; state.status=status; $('#search').value=''; render(); }
$('#reset-filters').addEventListener('click',()=>resetFilters());
$('#empty-reset').addEventListener('click',()=>resetFilters());
document.querySelectorAll('[data-overview]').forEach(button=>button.addEventListener('click',()=>resetFilters(button.dataset.overview === 'all' ? '' : button.dataset.overview)));
$('#type-nav').addEventListener('click',event=>{const button=event.target.closest('[data-type]');if(button){state.type=button.dataset.type;render();}});
$('#search').addEventListener('input',event=>{state.query=event.target.value;render();});
$('#status-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-status]');if(button){state.status=button.dataset.status;render();}});
$('#project-filter').addEventListener('change',event=>{state.project=event.target.value;render();});
$('#sort').addEventListener('change',render);
$('#gallery-view').addEventListener('click',()=>setView('gallery'));
$('#list-view').addEventListener('click',()=>setView('list'));
$('#theme-toggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
$('#metadata-tab').addEventListener('click',()=>showDetailPanel('metadata'));
$('#history-tab').addEventListener('click',()=>showDetailPanel('history'));
$('.detail-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 'metadata' : event.key === 'End' ? 'history' : state.detailPanel === 'metadata' ? 'history' : 'metadata';
  showDetailPanel(next); $(`#${next}-tab`).focus();
});
$('#canvas-toggle').addEventListener('click',()=>{ const dark=$('.detail-art').classList.toggle('dark-canvas'); $('#canvas-toggle').textContent=dark?'切换浅色画布':'切换深色画布'; });
$('#zoom-image').addEventListener('click',()=>{ $('#zoomed-image').src=$('#detail-image').src; $('#zoomed-image').alt=$('#detail-image').alt; $('#zoomed-caption').textContent=$('#detail-image').alt; $('#image-dialog').showModal(); });
$('#export').addEventListener('click',()=>{const link=node('a');link.href=`/api/manifest?${filters()}`;link.download='framevault-manifest.json';link.click();});
$('#load-demo').addEventListener('click',async()=>{const button=$('#load-demo');button.disabled=true;try{await api('/api/demo',{method:'POST',body:{}});await refresh();toast('原创演示素材已载入');}catch(error){toast(error.message,'error');}finally{button.disabled=false;}});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
document.addEventListener('keydown',event=>{
  if(event.isComposing || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
  if(event.key === '/') { event.preventDefault(); $('#search').focus(); }
  if(event.key.toLowerCase() === 'n') { event.preventDefault(); openUpload(); }
});

setTheme(preference('theme','light',['light','dark']));
setView(preference('view','gallery',['gallery','list']));

try { state.health=await api('/api/health');$('#ai-status').textContent=state.health.aiEnabled?'AI 服务已配置':'本地模式';await refresh(); }
catch(error){toast(`连接失败：${error.message}`,'error');$('#loading').hidden=true;$('#asset-grid').setAttribute('aria-busy','false');$('#empty').hidden=false;$('#empty h3').textContent='暂时无法连接素材库';$('#empty .empty-copy').textContent='请确认本地服务正在运行，然后刷新页面。';$('#load-demo').hidden=true;$('#empty-import').hidden=true;$('#empty-reset').hidden=true;}

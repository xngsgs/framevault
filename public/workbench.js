import { importItems, importSummary, runImportQueue, projectSummary, popularTags, selectAssets, reconcileSelection } from './library.js';

export function setupWorkbench({ $, state, node, icon, api, refresh, toast, fileData, setScope, showDetails }) {
  let visible = [];
  let queue = [];
  let urls = [];
  let importing = false;
  let stopRequested = false;
  let bulkSaving = false;
  let selectionSnapshot = [];
  const batchDialog = $('#batch-dialog');
  const bulkDialog = $('#bulk-dialog');

  function selectionChanged() {
    const selected = visible.filter(a => state.checked.has(a.id));
    $('#selection-summary').textContent = selected.length > 100 ? '每次最多整理 100 份，请减少选择' : selected.length ? `已选择 ${selected.length} 份素材` : '选择素材后可批量整理';
    $('#bulk-open').disabled = !selected.length || selected.length > 100;
    $('#clear-selection').hidden = !selected.length;
    $('#select-all').checked = !!visible.length && selected.length === visible.length;
    $('#select-all').indeterminate = selected.length > 0 && selected.length < visible.length;
    $('#select-all').disabled = !visible.length;
    document.querySelectorAll('.card-choice input').forEach(input => {
      input.checked = state.checked.has(input.value);
      input.closest('.asset-card').classList.toggle('is-selected', input.checked);
    });
  }
  $('#select-all').addEventListener('change', event => {
    visible.forEach(a => event.target.checked ? state.checked.set(a.id,a.latest.id) : state.checked.delete(a.id));
    selectionChanged();
  });
  $('#clear-selection').addEventListener('click', () => { state.checked.clear(); selectionChanged(); });
  $('#bulk-open').addEventListener('click', () => {
    selectionSnapshot = visible.filter(a => state.checked.has(a.id)).map(a => ({ id: a.id, version: state.checked.get(a.id) }));
    $('#bulk-form').reset(); $('#bulk-error').textContent = '';
    $('#bulk-count').textContent = `整理已选择的 ${selectionSnapshot.length} 份素材`;
    bulkDialog.showModal();
  });
  bulkDialog.addEventListener('cancel', event => { if (bulkSaving) event.preventDefault(); });
  $('#bulk-form').addEventListener('submit', async event => {
    event.preventDefault();
    const values = new FormData(event.target);
    const changes = {};
    if (values.get('project').trim()) changes.project = values.get('project').trim();
    if (values.get('status')) changes.status = values.get('status');
    if (!Object.keys(changes).length) { $('#bulk-error').textContent = '请填写项目或选择一种状态'; return; }
    bulkSaving = true; $('#bulk-error').textContent = '';
    const controls = [...bulkDialog.querySelectorAll('input,select,button')]; controls.forEach(el => { el.disabled = true; });
    try {
      await api('/api/assets/bulk', { method: 'PATCH', body: { ids: selectionSnapshot.map(a => a.id),
        versions: Object.fromEntries(selectionSnapshot.map(a => [a.id, a.version])), changes } });
      state.checked.clear(); bulkDialog.close();
      try { await refresh(); toast(`已整理 ${selectionSnapshot.length} 份素材`); }
      catch { toast('修改已保存，列表刷新失败，请重新连接素材库','error'); }
    } catch (error) { $('#bulk-error').textContent = error.message; }
    finally { bulkSaving = false; controls.forEach(el => { el.disabled = false; }); }
  });

  function releasePreviews() { urls.forEach(url => URL.revokeObjectURL(url)); urls = []; }
  function updateQueue() {
    const summary = importSummary(queue);
    $('#batch-summary').textContent = queue.length ? `共 ${queue.length} 张 · 已导入 ${summary.done} · 失败 ${summary.failed + summary.invalid} · 等待 ${summary.pending}` : '每批最多 20 张，每张不超过 10 MB';
    $('#batch-progress').max = queue.length || 1;
    $('#batch-progress').value = summary.done + summary.failed + summary.invalid;
    $('#batch-start').disabled = importing || !summary.pending;
    $('#batch-start').textContent = importing ? '正在导入…' : summary.done ? '继续导入剩余图片' : '开始导入';
    $('#batch-retry').hidden = importing || !summary.failed;
    $('#batch-stop').hidden = !importing;
    $('#batch-stop').disabled = stopRequested;
    $('#batch-stop').textContent = stopRequested ? '当前图片完成后暂停…' : '暂停后续导入';
    $('#batch-choose').hidden = importing;
    batchDialog.querySelectorAll('[data-close], #batch-file, #batch-form input:not([type="file"]), #batch-form select').forEach(el => { el.disabled = importing; });
    for (const item of queue) {
      const row = document.getElementById(`import-row-${item.id}`);
      if (!row) continue;
      row.dataset.state = item.status;
      row.querySelector('.queue-state').textContent = ({pending:'等待导入',uploading:'正在保存',done:'已导入',failed:'导入失败',invalid:'无法导入'})[item.status];
      row.querySelector('.queue-error').textContent = item.error;
      row.querySelector('input').disabled = importing || item.status === 'done' || item.status === 'invalid';
    }
  }
  function chooseFiles(files) {
    if (importing) return;
    try {
      const items = importItems(files);
      releasePreviews(); queue = items; $('#batch-error').textContent = '';
      $('#batch-choose strong').textContent = '重新选择图片（替换当前队列）';
      $('#batch-queue').replaceChildren(...queue.map(item => {
        const row = node('div', 'queue-row'); row.id = `import-row-${item.id}`;
        const img = node('img'); img.alt = '';
        if (item.status !== 'invalid') { img.src = URL.createObjectURL(item.file); urls.push(img.src); }
        const details = node('div', 'queue-details');
        const title = node('input'); title.value = item.title; title.maxLength = 120; title.required = item.status !== 'invalid';
        title.setAttribute('aria-label', `素材名称：${item.file.name}`);
        title.addEventListener('input', () => { item.title = title.value; });
        details.append(title, node('small', '', `${item.file.name} · ${(item.file.size / 1024).toFixed(1)} KB`), node('p', 'queue-error'));
        row.append(img, details, node('span', 'queue-state')); return row;
      }));
      updateQueue();
    } catch (error) { $('#batch-error').textContent = error.message; }
  }
  function openBatch() {
    releasePreviews(); queue = []; $('#batch-form').reset(); $('#batch-queue').replaceChildren();
    $('#batch-choose strong').textContent = '选择或拖入一组图片';
    $('#batch-error').textContent = ''; $('#batch-project').value = state.project; $('#batch-type').value = state.type || 'reference';
    updateQueue(); batchDialog.showModal();
  }
  $('#batch-import').addEventListener('click', openBatch);
  $('#batch-file').addEventListener('change', event => { if (event.target.files.length) chooseFiles(event.target.files); });
  const drop = $('#batch-drop');
  drop.addEventListener('dragover', event => { event.preventDefault(); if (!importing) drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('dragging'); chooseFiles(event.dataTransfer.files); });
  batchDialog.addEventListener('cancel', event => { if (importing) event.preventDefault(); });
  batchDialog.addEventListener('close', () => {
    if (!importing) { releasePreviews(); queue = []; $('#batch-queue').replaceChildren(); $('#batch-file').value = ''; }
  });
  $('#batch-stop').addEventListener('click', () => { stopRequested = true; updateQueue(); });
  async function startImport(retry = false) {
    if (importing || !$('#batch-form').reportValidity()) return;
    if (queue.some(i => ['pending', 'failed'].includes(i.status) && !i.title.trim())) {
      $('#batch-error').textContent = '请为待导入的图片填写名称'; return;
    }
    if (retry) queue.filter(i => i.status === 'failed').forEach(i => { i.status = 'pending'; });
    const project = $('#batch-project').value.trim(); const type = $('#batch-type').value;
    importing = true; stopRequested = false; $('#batch-error').textContent = ''; updateQueue();
    try {
      const summary = await runImportQueue(queue, {
        shouldStop: () => stopRequested, onChange: updateQueue,
        upload: async item => api('/api/assets', { method:'POST', body: { title:item.title.trim(), project, type,
          tags:[], filename:item.file.name, data:await fileData(item.file) } })
      });
      try { await refresh(); }
      catch { $('#batch-error').textContent = '已完成的图片已保存，列表刷新失败。请重新连接素材库。'; }
      toast(`本批已导入 ${summary.done} 张${summary.failed + summary.invalid ? `，${summary.failed + summary.invalid} 张未导入，请查看明细` : ''}`);
    } finally { importing = false; updateQueue(); }
  }
  $('#batch-form').addEventListener('submit', event => { event.preventDefault(); void startImport(); });
  $('#batch-retry').addEventListener('click', () => { void startImport(true); });

  function render(items) {
    visible = items;
    const changed = reconcileSelection(state.checked, items);
    selectionChanged();
    if (changed) toast(`${changed} 份素材有了新版本，已取消原选择。请检查新图后重新选择。`);
    const projects = projectSummary(state.assets);
    $('#workspace-summary').textContent = state.assets.length ? `${state.assets.length} 份素材，${projects.length} 个项目。每个版本都有来处。` : '从第一张图片开始，把创作和版本整理在一起。';
    $('#project-cards').replaceChildren(...projects.slice(0, 4).map(project => {
      const button = node('button', `project-card${state.project === project.name ? ' active' : ''}`);
      button.setAttribute('aria-label', `查看项目 ${project.name}`);
      const strip = node('div', 'project-strip');
      project.assets.slice(0, 3).forEach(a => { const img = node('img'); img.src = a.latest.url; img.alt = ''; strip.append(img); });
      const copy = node('div', 'project-copy'); copy.append(node('strong', '', project.name), node('span', '', `${project.assets.length} 份素材 · ${project.approved} 份已确认`));
      const progress = node('progress'); progress.max = project.assets.length; progress.value = project.approved;
      progress.setAttribute('aria-label', `${project.name} 确认进度`);
      button.append(strip, copy, progress); button.addEventListener('click', () => setScope({ project:project.name })); return button;
    }));
    $('#projects-empty').hidden = !!projects.length;
    const review = state.assets.filter(a => a.status === 'review');
    $('#review-note').textContent = review.length ? `${review.length} 份素材等待你确认` : '当前没有待审核素材';
    $('#review-shortcut').disabled = !review.length;
    const recent = selectAssets(state.assets, { project:state.project }).slice(0, 3);
    $('#recent-assets').replaceChildren(...recent.map(a => {
      const button = node('button', 'recent-asset'); const img = node('img'); img.src = a.latest.url; img.alt = '';
      const copy = node('span'); copy.append(node('strong', '', a.title), node('small', '', `${a.project} · v${a.latest.number}`));
      button.append(img, copy); button.addEventListener('click', () => showDetails(a.id)); return button;
    }));
    $('#recent-empty').hidden = !!recent.length;
    const tags = popularTags(selectAssets(state.assets, { project:state.project, type:state.type }));
    $('#tag-shortcuts').replaceChildren(...tags.map(([tag, count]) => {
      const button = node('button', `tag-shortcut${state.tag === tag ? ' active' : ''}`, tag);
      button.append(node('span', '', count)); button.setAttribute('aria-pressed', String(state.tag === tag));
      button.addEventListener('click', () => setScope({ project:state.project, type:state.type, tag:state.tag === tag ? '' : tag })); return button;
    }));
    $('#tags-empty').hidden = !!tags.length;
  }
  $('#review-shortcut').addEventListener('click', () => setScope({status:'review'}));
  $('#retry-connection').addEventListener('click', () => location.reload());
  return { render, selectionChanged };
}

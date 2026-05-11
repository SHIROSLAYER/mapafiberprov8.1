// ═══════════════════════════════════════════════
// ui.js — Interface: Estatísticas, Lista, Busca, Tema, Histórico
// ═══════════════════════════════════════════════

// ═══════ ESTATÍSTICAS, LISTA, CONFIRMAÇÃO ═══════
function updStats(){
  document.getElementById('cnt-a').textContent=armarios.length;
  document.getElementById('cnt-p').textContent=postes.length;
  document.getElementById('cnt-c').textContent=cabos.length;
  const tot=cabos.reduce((s,c)=>s+c.dist,0);
  document.getElementById('cnt-m').textContent=tot>=1000?(tot/1000).toFixed(3)+' km':tot+' m';
}

function updList(){
  const el=document.getElementById('elist');
  const C={poste:'#3B82F6',cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',olt:'#06B6D4',armario:'#EC4899'};
  if(!armarios.length&&!postes.length&&!cabos.length){el.innerHTML='<div style="padding:8px 12px;font-size:11px;color:var(--text3);font-family:var(--mono)">Nenhum elemento.</div>';return;}
  let h='';
  armarios.forEach(a=>{
    h+=`<div class="ei" data-id="${a.id}" onclick="zoomTo('${a.id}')" ondblclick="openFromList('${a.id}')"><div class="eid" style="background:${C.armario}"></div><span class="ein">${a.nome||a.id}</span><span class="eidel" onclick="event.stopPropagation();askRemoveById('${a.id}')">✕</span></div>`;
    const childOlts=olts.filter(o=>o.parentId===a.id);
    childOlts.forEach(o=>{h+=`<div class="ei" data-id="${o.id}" onclick="zoomTo('${o.id}')" ondblclick="openFromList('${o.id}')" style="padding-left:24px;border-left:2px solid #06B6D4"><div class="eid" style="background:#06B6D4"></div><span class="ein">${o.nome||o.id} <span style="color:var(--text3);font-size:9px">OLT</span></span><span class="eidel" onclick="event.stopPropagation();askRemoveById('${o.id}')">✕</span></div>`;});
  });
  postes.forEach(p=>{
    h+=`<div class="ei" data-id="${p.id}" onclick="zoomTo('${p.id}')" ondblclick="openFromList('${p.id}')"><div class="eid" style="background:${C.poste}"></div><span class="ein">${p.nome||p.id} <span style="color:var(--text3);font-size:9px">${(p.children||[]).length?'['+p.children.length+']':''}</span></span><span class="eidel" onclick="event.stopPropagation();askRemoveById('${p.id}')">✕</span></div>`;
    (p.children||[]).forEach(c=>{
      const cd=findById(c.id);if(!cd)return;
      const sp=cd.splitter?` <span style="color:var(--amber);font-size:9px">${cd.splitter}</span>`:'';
      h+=`<div class="ei" data-id="${cd.id}" onclick="zoomTo('${cd.id}')" ondblclick="openFromList('${cd.id}')" style="padding-left:24px;border-left:2px solid ${C[cd.tipo]||'#888'}"><div class="eid" style="background:${C[cd.tipo]||'#888'}"></div><span class="ein">${cd.nome||cd.id}${sp}</span><span class="eidel" onclick="event.stopPropagation();askRemoveById('${cd.id}')">✕</span></div>`;
    });
  });
  cabos.forEach(d=>{h+=`<div class="ei" data-id="${d.id}" onclick="zoomTo('${d.id}')" ondblclick="openFromList('${d.id}')"><div class="eid" style="background:${d.color}"></div><span class="ein">${d.nome||d.id} <span style='color:var(--text3)'>${d.total||''}FO</span></span><span class="eidel" onclick="event.stopPropagation();askRemoveById('${d.id}')">✕</span></div>`;});
  el.innerHTML=h;
}

function zoomTo(id){const d=findById(id);if(!d)return;if(d.tipo==='cabo')map.fitBounds(d.poly.getBounds(),{padding:[40,40]});else map.setView([d.lat,d.lng],17);selectedElem=d;hlElem(d);}
function openFromList(id){const d=findById(id);if(d)openEmModal(d);}
function findById(id){return postes.find(p=>p.id===id)||ctos.find(p=>p.id===id)||emendas.find(p=>p.id===id)||derivs.find(p=>p.id===id)||cabos.find(p=>p.id===id)||olts.find(p=>p.id===id)||armarios.find(p=>p.id===id);}
function askRemoveById(id){const d=findById(id);if(d)askRemove(d);}

function showConf(title,msg,ok,cancel,variant='red'){
  confCb=ok;confCancelCb=cancel;
  document.getElementById('conf-ttl').textContent=title;
  document.getElementById('conf-msg').innerHTML=msg;
  const btn=document.getElementById('conf-ok');
  btn.className='cfb ok'+(variant==='gn'?' gn':'');
  btn.textContent='Confirmar';
  document.getElementById('conf-overlay').classList.add('show');
}
function confOk(){document.getElementById('conf-overlay').classList.remove('show');if(confCb)confCb();confCb=null;confCancelCb=null;}
function confCancel(){document.getElementById('conf-overlay').classList.remove('show');if(confCancelCb)confCancelCb();confCb=null;confCancelCb=null;}


// ═══════ TEMA, BUSCA, DASHBOARD, UNDO/REDO, AUTOSAVE ═══════
function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.documentElement.style.filter = isDarkMode ? '' : 'invert(0.9) hue-rotate(180deg)';
  document.getElementById('theme-toggle').textContent = isDarkMode ? '☀️' : '🌙';
  localStorage.setItem('fibermap-theme', isDarkMode ? 'dark' : 'light');
  showToast(`Modo ${isDarkMode ? 'escuro' : 'claro'}`, 'success');
}

function performSearch() {
  const q = document.getElementById('search-input').value.toLowerCase();
  if(!q) { document.getElementById('search-results').innerHTML = ''; return; }
  const results = [];
  [...armarios, ...postes, ...ctos, ...emendas, ...derivs, ...cabos, ...olts].forEach(el => {
    if((el.nome && el.nome.toLowerCase().includes(q)) || el.id.toLowerCase().includes(q)) results.push(el);
  });
  let html = '';
  results.slice(0, 15).forEach(r => {
    const cor = {armario:'#EC4899',poste:'#3B82F6',cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',cabo:'#1D9E75',olt:'#06B6D4'}[r.tipo]||'#888';
    html += `<div class="search-result" onclick="zoomAndSelect('${r.id}')"><span style="color:${cor};font-weight:700">${r.tipo}</span> · ${r.nome||r.id}</div>`;
  });
  if(results.length > 15) html += `<div class="search-result" style="text-align:center;color:var(--text3);">+${results.length-15} mais...</div>`;
  document.getElementById('search-results').innerHTML = html || '<div class="search-result" style="color:var(--text3);">Nenhum resultado</div>';
}

function zoomAndSelect(id) {
  const d = findById(id);
  if(!d) return;
  if(d.tipo === 'cabo') map.fitBounds(d.poly.getBounds(), {padding:[40,40]});
  else map.setView([d.lat, d.lng], 17);
  selectedElem = d;
  hlElem(d);
  setTimeout(() => openEmModal(d), 200);
}

function undoAction() { if(stateManager.undo()) { updStats(); debouncedUpdList(); } }
function redoAction() { if(stateManager.redo()) { updStats(); debouncedUpdList(); } }

let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  document.getElementById('sb-autosave').textContent = '● Salvando...';
  autosaveTimer = setTimeout(() => {
    saveProjectToLocal();
    document.getElementById('sb-autosave').textContent = '● Sincronizado';
  }, 800);
}


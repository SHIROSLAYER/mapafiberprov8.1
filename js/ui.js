// ═══════════════════════════════════════════════
// ui.js — Interface: Estatísticas, Lista, Busca, Tema, Histórico
// ═══════════════════════════════════════════════

// ═══════ ESTATÍSTICAS, LISTA, CONFIRMAÇÃO ═══════
function updStats(){
  document.getElementById('cnt-a').textContent=armarios.length;
  document.getElementById('cnt-p').textContent=postes.length;
  document.getElementById('cnt-c').textContent=cabos.length;
  const tot=cabos.reduce((s,c)=>s+(Number.isFinite(c.dist)?c.dist:0),0);
  // Formato 0km.0m sempre (ex: 1km.234m / 0km.150m)
  const km=Math.floor(tot/1000);
  const mr=Math.round(tot%1000);
  document.getElementById('cnt-m').textContent=km+'km.'+mr+'m';
}

// Estado de expansão da árvore (persistido em localStorage)
const _treeExp=new Set((function(){try{return JSON.parse(localStorage.getItem('fibermap-tree-exp'))||[];}catch(e){return [];}})());
function _saveTreeExp(){try{localStorage.setItem('fibermap-tree-exp',JSON.stringify([..._treeExp]));}catch(e){}}
function toggleTreeNode(uid){
  if(_treeExp.has(uid))_treeExp.delete(uid);else _treeExp.add(uid);
  _saveTreeExp();updList();
}
function isTreeExp(uid){return _treeExp.has(uid);}

// Acha cabo+fibra conectado a uma PON específica (out:OLT.ponIdx) em qualquer poste/armário
function findCableConnectedToPON(oltId,ponIdx){
  const eidTarget='out:'+oltId;
  const all=[].concat(postes||[],armarios||[]);
  for(const d of all){
    const conns=(d.fibers&&d.fibers.connections)||[];
    for(const c of conns){
      if(c.fromId===eidTarget&&c.fromFi===ponIdx){
        if(c.toId.startsWith('cable:')){
          return {cabId:c.toId.slice(6).replace('::I','').replace('::O',''),fi:c.toFi};
        }
      }
      if(c.toId===eidTarget&&c.toFi===ponIdx){
        if(c.fromId.startsWith('cable:')){
          return {cabId:c.fromId.slice(6).replace('::I','').replace('::O',''),fi:c.fromFi};
        }
      }
    }
  }
  return null;
}

function getPostesForCable(cabId){
  const c=cabos.find(x=>x.id===cabId);
  if(!c||!c.anchorMap)return [];
  return Object.keys(c.anchorMap).map(i=>parseInt(i)).sort((a,b)=>a-b)
    .map(i=>findById(c.anchorMap[i]))
    .filter(el=>el&&el.tipo==='poste');
}

function _treeRow(uid,depth,color,iconChar,name,refId,tag,meta,canExpand,opts){
  opts=opts||{};
  const exp=canExpand&&isTreeExp(uid);
  const chev=canExpand?(exp?'▾':'▸'):'';
  const click=refId?`onclick="zoomTo('${escJs(refId)}')" ondblclick="openFromList('${escJs(refId)}')"`:'';
  const del=(refId&&!opts.noDel)?`<span class="eidel" onclick="event.stopPropagation();askRemoveById('${escJs(refId)}')">✕</span>`:'';
  const chevAttr=canExpand?`onclick="event.stopPropagation();toggleTreeNode('${escJs(uid)}')"`:'';
  const tagHtml=tag?`<span class="ei-tag" style="color:${color}">${escH(tag)}</span>`:'';
  const metaHtml=meta?`<span class="ei-meta">${(meta&&typeof meta==='object'&&'__html'in meta)?meta.__html:escH(meta)}</span>`:'';
  return {html:`<div class="ei ei-tree" ${click} style="padding-left:${depth*14+6}px;border-left:3px solid ${color}55">`+
    `<span class="ei-chev" ${chevAttr}>${chev}</span>`+
    `<span class="ei-icon" style="background:${color};color:#fff;border:1px solid rgba(0,0,0,.3)">${iconChar}</span>`+
    `<span class="ein">${escH(name)}${tagHtml}${metaHtml}</span>${del}</div>`,
    exp:exp};
}

function updList(){
  const el=document.getElementById('elist');
  if(!armarios.length&&!postes.length&&!cabos.length){
    el.innerHTML='<div class="el-empty">Nenhum elemento cadastrado.</div>';return;
  }
  let h='';
  // ── ARMÁRIOS (topo, com hierarquia OLT > PON > Cabo > Postes) ──
  if(armarios.length){
    h+='<div class="el-sect">🗄️ Armários</div>';
    armarios.forEach(a=>{
      const aId='a:'+a.id;
      const childOlts=olts.filter(o=>o.parentId===a.id);
      const childMpls=(typeof mpls!=='undefined'?mpls.filter(m=>m.parentId===a.id):[]);
      const subTotal=childOlts.length+childMpls.length;
      const subMeta=[childOlts.length?childOlts.length+' OLT':null,childMpls.length?childMpls.length+' MPLS':null].filter(Boolean).join(' · ');
      const aRow=_treeRow(aId,0,'#EC4899','🗄',a.nome||a.id,a.id,'Armário',subMeta||null,subTotal>0);
      h+=aRow.html;
      if(aRow.exp){
        childMpls.forEach(m=>{
          const mId='m:'+m.id;
          const fibras=m.portas||4;
          h+=_treeRow(mId,1,'#EF4444','▣',m.nome||m.id,m.id,'MPLS',fibras+' fibras',false).html;
        });
        childOlts.forEach(o=>{
          const oId='o:'+o.id;
          const pons=o.portas||16;
          const oRow=_treeRow(oId,1,'#06B6D4','📡',o.nome||o.id,o.id,'OLT',pons+' PON',pons>0);
          h+=oRow.html;
          if(oRow.exp){
            for(let pi=0;pi<pons;pi++){
              const conn=findCableConnectedToPON(o.id,pi);
              const pId='p:'+o.id+':'+pi;
              const ponName='PON '+(pi+1);
              const ponMeta=conn?new SafeStr(`<span style="color:var(--green)">→ ${escH(conn.cabId)}</span>`):new SafeStr('<span style="color:var(--text3)">livre</span>');
              const pRow=_treeRow(pId,2,conn?'#10B981':'#475569','🔌',ponName,null,null,ponMeta,!!conn,{noDel:true});
              h+=pRow.html;
              if(pRow.exp&&conn){
                const cab=cabos.find(c=>c.id===conn.cabId);
                if(cab){
                  const cId='c:'+cab.id+':'+pId;
                  const fiberInfo=cab.grupos>1?'T'+(Math.floor(conn.fi/cab.fpg)+1)+' F'+((conn.fi%cab.fpg)+1):'F'+(conn.fi+1);
                  const postesAnch=getPostesForCable(cab.id);
                  const cRow=_treeRow(cId,3,cab.color,'⌇',cab.nome||cab.id,cab.id,'Cabo',fiberInfo+' · '+postesAnch.length+' postes',postesAnch.length>0);
                  h+=cRow.html;
                  if(cRow.exp){
                    postesAnch.forEach(p=>{
                      h+=_treeRow('px:'+p.id+':'+cId,4,'#3B82F6','⫶',p.nome||p.id,p.id,null,null,false).html;
                    });
                  }
                }
                // Mostra clientes que estão nesse circuito
                if(typeof clientesNoCaminho==='function'){
                  const clients=clientesNoCaminho(o.id,pi);
                  clients.forEach(cc=>{
                    const meta=(cc.cliente.plano||'')+(cc.cliente.endereco?' · '+cc.cliente.endereco.slice(0,20):'');
                    h+='<div class="ei ei-tree" style="padding-left:'+(3*14+6)+'px;border-left:3px solid #10B98155;cursor:pointer" onclick="openClienteModal(findById(\''+escJs(cc.cto.id)+'\'),'+cc.porta+',(findById(\''+escJs(cc.cto.id)+'\').clientes||[]).find(x=>x.id===\''+escJs(cc.cliente.id)+'\'))">'+
                      '<span class="ei-chev"></span>'+
                      '<span class="ei-icon" style="background:#10B981;color:#fff">👤</span>'+
                      '<span class="ein"><b>'+escH(cc.cliente.nome)+'</b>'+
                      ' <span class="ei-tag" style="color:#10B981">Cliente</span>'+
                      (meta?' <span class="ei-meta">'+escH(meta)+'</span>':'')+
                      '</span></div>';
                  });
                }
              }
            }
          }
        });
      }
    });
  }
  // ── POSTES ──
  if(postes.length){
    h+='<div class="el-sect">⫶ Postes</div>';
    postes.forEach(p=>{
      const pId='P:'+p.id;
      const kids=(p.children||[]).map(c=>findById(c.id)).filter(Boolean);
      const pRow=_treeRow(pId,0,'#3B82F6','⫶',p.nome||p.id,p.id,'Poste',kids.length?kids.length+' sub':null,kids.length>0);
      h+=pRow.html;
      if(pRow.exp){
        kids.forEach(c=>{
          const cm={cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',olt:'#06B6D4'};
          const lm={cto:'CTO',emenda:'CEO',deriv:'Deriv',olt:'OLT'};
          const ic={cto:'C',emenda:'E',deriv:'⑂',olt:'O'};
          const meta=c.splitter?c.splitter:'';
          h+=_treeRow('sp:'+c.id,1,cm[c.tipo]||'#888',ic[c.tipo]||'·',c.nome||c.id,c.id,lm[c.tipo]||c.tipo,meta,false).html;
        });
      }
    });
  }
  // ── CABOS (lista solta no fim, com tooltip da rota) ──
  if(cabos.length){
    h+='<div class="el-sect">⌇ Cabos</div>';
    cabos.forEach(c=>{
      const anch=getPostesForCable(c.id);
      const meta=(c.total||'?')+'FO'+(anch.length?' · '+anch.length+' postes':'');
      h+=_treeRow('CB:'+c.id,0,c.color,'⌇',c.nome||c.id,c.id,c.typeName||c.typeId||'Cabo',meta,false).html;
    });
  }
  el.innerHTML=h;
}

function zoomTo(id){const d=findById(id);if(!d)return;if(d.tipo==='cabo')map.fitBounds(d.poly.getBounds(),{padding:[40,40]});else map.setView([d.lat,d.lng],17);selectedElem=d;hlElem(d);}
function openFromList(id){const d=findById(id);if(d)openEmModal(d);}
function findById(id){
  if(typeof _idIndex!=='undefined'){
    const hit=_idIndex.get(id);
    if(hit)return hit;
  }
  return postes.find(p=>p.id===id)||ctos.find(p=>p.id===id)||emendas.find(p=>p.id===id)||derivs.find(p=>p.id===id)||cabos.find(p=>p.id===id)||olts.find(p=>p.id===id)||(typeof mpls!=='undefined'?mpls.find(p=>p.id===id):null)||armarios.find(p=>p.id===id);
}
function askRemoveById(id){const d=findById(id);if(d)askRemove(d);}

function showConf(title,msg,ok,cancel,variant='red'){
  confCb=ok;confCancelCb=cancel;
  document.getElementById('conf-ttl').textContent=title;
  document.getElementById('conf-msg').innerHTML=msg;
  const btn=document.getElementById('conf-ok');
  btn.className='cfb ok'+(variant==='gn'?' gn':'');
  btn.textContent='Confirmar';
  // Restaura botão Cancelar caso tenha sido escondido por showAlert
  const cancelBtn=document.querySelector('#conf-btns .cfb:not(.ok)');
  if(cancelBtn)cancelBtn.style.display='';
  document.getElementById('conf-overlay').classList.add('show');
}
// Alerta informativo com APENAS botão OK (sem ação destrutiva, sem cancelar)
function showAlert(title,msg,cb){
  confCb=cb||null;confCancelCb=null;
  document.getElementById('conf-ttl').textContent=title;
  document.getElementById('conf-msg').innerHTML=msg;
  const btn=document.getElementById('conf-ok');
  btn.className='cfb ok gn';
  btn.textContent='OK';
  const cancelBtn=document.querySelector('#conf-btns .cfb:not(.ok)');
  if(cancelBtn)cancelBtn.style.display='none';
  document.getElementById('conf-overlay').classList.add('show');
}
function confOk(){document.getElementById('conf-overlay').classList.remove('show');const cb=confCb;confCb=null;confCancelCb=null;if(cb)cb();}
function confCancel(){document.getElementById('conf-overlay').classList.remove('show');const cb=confCancelCb;confCb=null;confCancelCb=null;if(cb)cb();}


// ═══════ TEMA, BUSCA, DASHBOARD, UNDO/REDO, AUTOSAVE ═══════
function toggleTheme() {
  // Alternância de tema desativada — tema escuro fixo
}

// ═══════ MODAL DE BOAS-VINDAS / NOVIDADES ═══════
function closeWelcomeModal(){
  var cb=document.getElementById('welcome-dontshow');
  if(cb&&cb.checked){
    // Marca esta versão como vista → não reaparece até a próxima atualização
    try{localStorage.setItem('fibermap-welcome-seen-version',WELCOME_VERSION);}catch(e){}
  }
  var ov=document.getElementById('welcome-overlay');
  if(ov)ov.classList.remove('show');
}

function performSearch() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  if(!q) { document.getElementById('search-results').innerHTML = ''; return; }
  const results = [];
  const COR = {armario:'#EC4899',poste:'#3B82F6',cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',cabo:'#1D9E75',olt:'#06B6D4',mpls:'#EF4444'};
  // Elementos
  [...armarios, ...postes, ...ctos, ...emendas, ...derivs, ...cabos, ...olts, ...(typeof mpls!=='undefined'?mpls:[])].forEach(el => {
    const fields = [el.nome, el.id, el.obs].filter(Boolean).join(' ').toLowerCase();
    if (fields.includes(q)) results.push({type:'elem', el, label:el.nome||el.id, meta:el.tipo});
  });
  // Clientes (CTO/Deriv)
  [].concat(ctos||[], derivs||[]).forEach(parent => {
    (parent.clientes||[]).forEach(c => {
      const fields = [c.nome, c.endereco, c.telefone, c.onuSerial, c.plano].filter(Boolean).join(' ').toLowerCase();
      if (fields.includes(q)) results.push({type:'cliente', el:parent, cliente:c, label:c.nome, meta:c.endereco||c.plano||c.onuSerial});
    });
  });
  let html = '';
  results.slice(0, 25).forEach(r => {
    if (r.type === 'cliente') {
      const ctolbl = (r.el.tipo==='cto'?'CTO ':'Deriv ')+(r.el.nome||r.el.id);
      html += `<div class="search-result" onclick="openClienteFromSearch('${escJs(r.el.id)}','${escJs(r.cliente.id)}')">
        <span style="color:#10B981;font-weight:700">👤 ${escH(r.label)}</span>
        <span style="color:var(--text3);font-size:10px;font-family:var(--mono);display:block;margin-top:2px">${escH(ctolbl)} · porta ${r.cliente.porta+1}${r.meta?' · '+escH(r.meta):''}</span></div>`;
    } else {
      const cor = COR[r.el.tipo] || '#888';
      html += `<div class="search-result" onclick="zoomAndSelect('${escJs(r.el.id)}')">
        <span style="color:${cor};font-weight:700">${escH(r.meta)}</span> · ${escH(r.label)}
        ${r.el.obs?`<span style="color:var(--text3);font-size:10px;font-family:var(--mono);display:block;margin-top:2px">${escH(r.el.obs.slice(0,60))}</span>`:''}
      </div>`;
    }
  });
  if(results.length > 25) html += `<div class="search-result" style="text-align:center;color:var(--text3);">+${results.length-25} mais...</div>`;
  document.getElementById('search-results').innerHTML = html || '<div class="search-result" style="color:var(--text3);">Nenhum resultado</div>';
}
function openClienteFromSearch(parentId, clienteId){
  const parent = findById(parentId);
  if(!parent) return;
  const cliente = (parent.clientes||[]).find(c => c.id === clienteId);
  if(!cliente) return;
  // Foca no elemento pai no mapa
  map.setView([parent.lat, parent.lng], 18);
  // Abre modal de edição do cliente
  openClienteModal(parent, cliente.porta, cliente);
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
  // Bloqueia autosave enquanto IDB ainda está hidratando, senão um
  // localStorage parcial sobrescreve dados maiores que ainda virão do IDB.
  if(window._projectLoading){
    clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(scheduleAutosave,200);
    return;
  }
  clearTimeout(autosaveTimer);
  document.getElementById('sb-autosave').textContent = '● Salvando...';
  autosaveTimer = setTimeout(() => {
    saveProjectToLocal();
    // Status final (sincronizado/falha) é controlado dentro do saveProjectToLocal.
    // Atualiza heatmap se ativo (atenuação mudou)
    if(typeof refreshHeatmap==='function')refreshHeatmap();
    // Recalcula alertas
    if(typeof checkAlerts==='function')checkAlerts();
  }, 800);
}


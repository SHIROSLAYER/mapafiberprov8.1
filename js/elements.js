// ═══════════════════════════════════════════════
// elements.js — Adicionar e Remover Elementos
// ═══════════════════════════════════════════════

// ═══════ UNICIDADE DE IDs E NOMES ═══════
// Garante que nenhum elemento (poste, armário, OLT, CTO, emenda, derivação, cabo)
// compartilhe ID ou nome auto-gerado. Ao detectar duplicata, sufixo "-2", "-3"...
function _allElems(){
  return [].concat(armarios||[],postes||[],olts||[],ctos||[],emendas||[],derivs||[],cabos||[]);
}
function getAllUsedIds(except){
  const set=new Set();
  _allElems().forEach(e=>{if(e!==except)set.add(e.id);});
  return set;
}
function getAllUsedNames(except){
  const set=new Set();
  _allElems().forEach(e=>{if(e!==except&&e.nome)set.add(e.nome);});
  return set;
}
function uniqueId(baseId,except){
  const taken=getAllUsedIds(except);
  if(!taken.has(baseId))return baseId;
  let i=2;
  while(taken.has(baseId+'-'+i))i++;
  return baseId+'-'+i;
}
function uniqueName(baseName,except){
  if(!baseName)return baseName;
  const taken=getAllUsedNames(except);
  if(!taken.has(baseName))return baseName;
  let i=2;
  while(taken.has(baseName+' ('+i+')'))i++;
  return baseName+' ('+i+')';
}
// Re-escreve um eid de fibra (cable:ID, cable:ID::I/O, in:ID, out:ID) trocando ID
function _renameFiberEid(eid,oldId,newId){
  if(!eid)return eid;
  if(eid==='cable:'+oldId)return 'cable:'+newId;
  if(eid==='cable:'+oldId+'::I')return 'cable:'+newId+'::I';
  if(eid==='cable:'+oldId+'::O')return 'cable:'+newId+'::O';
  if(eid==='in:'+oldId)return 'in:'+newId;
  if(eid==='out:'+oldId)return 'out:'+newId;
  return eid;
}
// Atualiza TODAS as referências a um ID antigo após renomeação
function _updateAllRefs(oldId,newId){
  if(oldId===newId)return;
  _allElems().forEach(e=>{
    if(e.parentId===oldId)e.parentId=newId;
    if(Array.isArray(e.children)){
      e.children.forEach(c=>{if(c.id===oldId)c.id=newId;});
    }
    if(e.fibers&&Array.isArray(e.fibers.connections)){
      e.fibers.connections.forEach(conn=>{
        conn.fromId=_renameFiberEid(conn.fromId,oldId,newId);
        conn.toId=_renameFiberEid(conn.toId,oldId,newId);
      });
    }
    if(e.fibers&&e.fibers.diagramPositions){
      const np={};
      Object.keys(e.fibers.diagramPositions).forEach(k=>{
        let nk=k;
        if(k==='cable:'+oldId)nk='cable:'+newId;
        else if(k==='cable:'+oldId+'::I')nk='cable:'+newId+'::I';
        else if(k==='cable:'+oldId+'::O')nk='cable:'+newId+'::O';
        else if(k==='child:'+oldId)nk='child:'+newId;
        np[nk]=e.fibers.diagramPositions[k];
      });
      e.fibers.diagramPositions=np;
    }
  });
  (cabos||[]).forEach(c=>{
    if(Array.isArray(c.anchors))c.anchors=c.anchors.map(a=>a===oldId?newId:a);
    if(c.anchorMap){
      Object.keys(c.anchorMap).forEach(k=>{
        if(c.anchorMap[k]===oldId)c.anchorMap[k]=newId;
      });
    }
  });
}
// Detecta duplicatas em todo o projeto, renomeia e atualiza referências.
// Retorna {ids:[{oldId,newId}], names:[{oldName,newName,id}]}
function dedupeProject(){
  const seenIds=new Set();
  const renamedIds=[];
  _allElems().forEach(e=>{
    if(!e.id){e.id='X-'+Math.random().toString(36).slice(2,8);}
    if(!seenIds.has(e.id)){seenIds.add(e.id);return;}
    const oldId=e.id;
    const newId=uniqueId(oldId,e);
    e.id=newId;
    _updateAllRefs(oldId,newId);
    seenIds.add(newId);
    renamedIds.push({oldId,newId});
  });
  const seenNames=new Set();
  const renamedNames=[];
  _allElems().forEach(e=>{
    if(!e.nome)return;
    if(!seenNames.has(e.nome)){seenNames.add(e.nome);return;}
    const oldName=e.nome;
    const newName=uniqueName(oldName,e);
    e.nome=newName;
    seenNames.add(newName);
    renamedNames.push({oldName,newName,id:e.id});
  });
  const total=renamedIds.length+renamedNames.length;
  if(total>0){
    console.warn('[Dedupe] '+renamedIds.length+' IDs e '+renamedNames.length+' nomes renomeados',{ids:renamedIds,names:renamedNames});
    if(typeof showToast==='function'){
      showToast('⚠ '+total+' duplicata(s) renomeada(s) automaticamente — veja o console','warning');
    }
  }
  return {ids:renamedIds,names:renamedNames};
}

// ═══════ STATUS DE USO DE PONs DA OLT ═══════
// Conta quantas PONs (out:OLT_ID, fi=0..N-1) têm conexão de fibra registrada
// em qualquer poste/armário (a OLT mora num armário mas suas PONs podem ser
// conectadas em diagramas de outros elementos).
function getOltUsage(oltId,totalPorts){
  totalPorts=totalPorts||16;
  var used=new Set();
  var eid='out:'+oltId;
  [].concat(armarios||[],postes||[]).forEach(function(d){
    var conns=(d.fibers&&d.fibers.connections)||[];
    conns.forEach(function(c){
      if(!c)return;
      if(c.fromId===eid)used.add(c.fromFi);
      if(c.toId===eid)used.add(c.toFi);
    });
  });
  // Filtra apenas portas dentro do range
  var usedCount=0;
  used.forEach(function(fi){if(fi>=0&&fi<totalPorts)usedCount++;});
  return {used:usedCount,total:totalPorts,pct:totalPorts?(usedCount/totalPorts):0,free:totalPorts-usedCount};
}
// Aplica auto-rename a TODAS as Derivações existentes cujo input já está
// conectado a um cabo que rastreia até uma OLT — usado em projetos importados
// ou criados antes do auto-rename ser implementado.
function autoNameAllDerivs(){
  if(!derivs||!derivs.length||typeof findOLTForFiber!=='function')return [];
  var renamed=[];
  derivs.forEach(function(d){
    var nm=d.nome||'';
    var autoLike=(nm===d.id)||(nm==='Derivação '+d.id)||/^(Derivação D\d+|D\d+)$/.test(nm);
    if(!autoLike)return;
    // Acha a conexão de entrada (in:d.id fi=0) em qualquer poste/armário
    var found=null;
    [].concat(postes||[],armarios||[]).forEach(function(parent){
      if(found)return;
      var cs=(parent.fibers&&parent.fibers.connections)||[];
      cs.forEach(function(c){
        if(found||!c)return;
        var peer=null;
        if(c.fromId==='in:'+d.id&&c.fromFi===0)peer={eid:c.toId,fi:c.toFi};
        else if(c.toId==='in:'+d.id&&c.toFi===0)peer={eid:c.fromId,fi:c.fromFi};
        if(peer&&peer.eid.indexOf('cable:')===0){
          var cabId=peer.eid.slice(6).replace('::I','').replace('::O','');
          var info=findOLTForFiber(cabId,peer.fi);
          if(info)found=info;
        }
      });
    });
    if(found){
      var newName=found.nome+' · PON-'+found.pon;
      if(typeof uniqueName==='function')newName=uniqueName(newName,d);
      var oldName=d.nome;
      d.nome=newName;
      renamed.push({id:d.id,oldName:oldName,newName:newName});
    }
  });
  if(renamed.length){
    console.warn('[Auto-rename] '+renamed.length+' Derivação(ões) renomeada(s):',renamed);
    if(typeof showToast==='function'){
      showToast('✓ '+renamed.length+' Derivação(ões) renomeada(s) automaticamente pela OLT de origem','success');
    }
  }
  return renamed;
}

function oltUsageColor(pct){
  if(pct>=0.9)return '#EF4444';   // crítico
  if(pct>=0.7)return '#F59E0B';   // atenção
  if(pct>0)return '#10B981';      // OK
  return '#9ca3af';               // não usado
}

// ═══════ ADICIONAR / REMOVER ELEMENTOS ═══════
function addArmario(lat,lng,opts={}){
  armcnt++;const num=opts.num||armcnt;
  let id=opts.id||('ARM-'+String(num).padStart(2,'0'));
  if(!opts._restoring)id=uniqueId(id);
  let nome=opts.nome||`Armário ${num}`;
  if(!opts._restoring)nome=uniqueName(nome);
  const d={id,num,lat,lng,tipo:'armario',nome:nome,capacidade:opts.capacidade||24,obs:opts.obs||'',children:[],fibers:{connections:[],splitters:[],diagramPositions:{}}};
  const mk = L.marker([lat,lng], {icon: armarioIcon, draggable: true});
  d.marker = mk;
  clusterArmarios.addLayer(mk);
  armarios.push(d);
  bindArmarioTooltip(d);
  mk.on('click',e=>{L.DomEvent.stopPropagation(e);handleElemClick(d);});
  bindDblTap(mk,()=>openEmModal(d));
  mk.on('dragstart',()=>{d._pLat=d.lat;d._pLng=d.lng;});
  mk.on('dragend',()=>confirmMove(d));
  updStats();debouncedUpdList();scheduleAutosave();
  if(!opts._restoring) stateManager.pushState('Criar Armário');
  return d;
}

function addPoste(lat,lng,opts={}){
  pcnt++;const num=opts.num||pcnt;
  let id=opts.id||('P'+num);
  if(!opts._restoring)id=uniqueId(id);
  let nome=opts.nome||`Poste ${num}`;
  if(!opts._restoring)nome=uniqueName(nome);
  const d={id,num,lat,lng,tipo:'poste',nome:nome,obs:opts.obs||'',children:[],fibers:{connections:[],splitters:[],diagramPositions:{}}};
  const mk = L.marker([lat,lng], {icon: buildPosteIcon(d), draggable: true});
  d.marker = mk;
  clusterPostes.addLayer(mk);
  postes.push(d);
  bindPosteTooltip(d);
  mk.on('click',e=>{L.DomEvent.stopPropagation(e);handleElemClick(d);});
  bindDblTap(mk,()=>openEmModal(d));
  mk.on('dragstart',()=>{d._pLat=d.lat;d._pLng=d.lng;});
  mk.on('dragend',()=>confirmMove(d));
  updStats();debouncedUpdList();scheduleAutosave();
  if(!opts._restoring) stateManager.pushState('Criar Poste');
  return d;
}

function addSubElement(tipo,parent,opts={}){
  const lat=parent.lat+0.00015,lng=parent.lng+0.00015;
  let d;
  if(tipo==='olt'){
    oltcnt++;const num=opts.num||oltcnt;
    let id=opts.id||('OLT-'+String(num).padStart(2,'0'));
    if(!opts._restoring)id=uniqueId(id);
    let nome=opts.nome||id;
    if(!opts._restoring)nome=uniqueName(nome);
    d={id,num,lat,lng,tipo:'olt',nome:nome,portas:opts.portas||16,parentId:parent.id,obs:opts.obs||'',fibers:{connections:[],diagramPositions:{}}};
    olts.push(d);
  }else if(tipo==='cto'){
    ctocnt++;const num=opts.num||ctocnt;
    let id=opts.id||('CTO-'+String(num).padStart(2,'0'));
    if(!opts._restoring)id=uniqueId(id);
    let nome=opts.nome||id;
    if(!opts._restoring)nome=uniqueName(nome);
    d={id,num,lat,lng,tipo:'cto',nome:nome,portas:opts.portas||8,splitter:opts.splitter||null,parentId:parent.id,obs:opts.obs||'',fibers:{connections:[],splitters:[],diagramPositions:{}}};
    ctos.push(d);
  }else if(tipo==='emenda'){
    emcnt++;const num=opts.num||emcnt;
    let id=opts.id||('E'+String(num).padStart(2,'0'));
    if(!opts._restoring)id=uniqueId(id);
    let nome=opts.nome||('Emenda '+id);
    if(!opts._restoring)nome=uniqueName(nome);
    d={id,num,lat,lng,tipo:'emenda',nome:nome,bandejas:opts.bandejas||12,parentId:parent.id,obs:opts.obs||'',fibers:{connections:[],splitters:[],diagramPositions:{}}};
    emendas.push(d);
  }else if(tipo==='deriv'){
    dcnt++;const num=opts.num||dcnt;
    let id=opts.id||('D'+String(num).padStart(2,'0'));
    if(!opts._restoring)id=uniqueId(id);
    let nome=opts.nome||('Derivação '+id);
    if(!opts._restoring)nome=uniqueName(nome);
    d={id,num,lat,lng,tipo:'deriv',nome:nome,capacidade:opts.capacidade||8,splitter:opts.splitter||null,parentId:parent.id,obs:opts.obs||'',fibers:{connections:[],splitters:[],diagramPositions:{}}};
    derivs.push(d);
  }
  if(!parent.children)parent.children=[];
  parent.children.push({tipo,id:d.id});
  if(parent.tipo==='armario')refreshArmarioIcon(parent); else refreshPosteIcon(parent);
  bindPosteTooltip(parent);
  updStats();debouncedUpdList();scheduleAutosave();
  if(!opts._restoring) stateManager.pushState(`Criar ${tipo}`);
  return d;
}

function confirmMove(d){
  const pos=d.marker.getLatLng();
  const nl=pos.lat,ng=pos.lng;
  const oldLat=d._pLat,oldLng=d._pLng;
  if(Math.abs(nl-d.lat)<0.00001&&Math.abs(ng-d.lng)<0.00001)return;
  // Distância em metros entre posição antiga e nova
  const distMoved=L.latLng(oldLat,oldLng).distanceTo(L.latLng(nl,ng));
  const distFmt=distMoved>=1000?(distMoved/1000).toFixed(3)+' km':Math.round(distMoved)+' m';
  const tipo=({poste:'Poste',armario:'Armário',cto:'CTO',emenda:'Emenda',deriv:'Derivação',olt:'OLT'}[d.tipo]||d.tipo);
  const nome=d.nome||d.id;
  showConf(
    `Confirmar movimentação`,
    `<div style="font-size:13px;line-height:1.7">Deseja mover <b>${tipo} ${nome}</b> para a nova posição?<br>` +
      `<span style="color:#9ca3af;font-family:var(--mono);font-size:11px">` +
      `Deslocamento: <b style="color:#F59E0B">${distFmt}</b><br>` +
      `Nova posição: ${nl.toFixed(6)}, ${ng.toFixed(6)}` +
      `</span></div>`,
    function(){
      // CONFIRMA: fixa nova posição
      stateManager.pushState(`Mover ${nome}`);
      d.lat=nl;d.lng=ng;
      updateAnchoredCabos(d);
      updateConnLines();
      updStats();
      scheduleAutosave();
    },
    function(){
      // CANCELA: volta pra posição original
      d.marker.setLatLng([oldLat,oldLng]);
      showToast('Movimentação cancelada','info');
    },
    'gn'
  );
}

function updateAnchoredCabos(poste){
  cabos.forEach(c=>{
    if(!c.anchorMap)return;
    let changed=false;
    for(const idx in c.anchorMap){
      if(c.anchorMap[idx]===poste.id){
        c.points[idx]=[poste.lat,poste.lng];
        changed=true;
      }
    }
    if(changed){
      c.poly.setLatLngs(c.points);
      c.dist = calcDist(c.points);
    }
  });
  updStats();
  if(currentEM && currentEM.tipo==='cabo') openEmModal(currentEM);
}

function updateConnLines(){
  connections.forEach(conn=>{
    if(conn.line)map.removeLayer(conn.line);
    conn.line=L.polyline([[conn.a.lat,conn.a.lng],[conn.b.lat,conn.b.lng]],{color:'#8b949e',weight:1.5,dashArray:'6,4',opacity:.7}).addTo(map);
  });
}

// ═══════ REMOÇÃO ═══════
function askRemove(d){
  showConf('Remover elemento?',`Remove <strong>${d.nome||d.id}</strong> e todas as conexões associadas.`,()=>{
    stateManager.pushState(`Deletar ${d.nome||d.id}`);
    doRemove(d);
  },null,'red');
}
function doRemove(d){
  if(d.tipo==='armario'){
    [...olts.filter(o=>o.parentId===d.id)].forEach(sub=>doRemove(sub));
    const i=armarios.findIndex(p=>p.id===d.id);
    if(i>=0){ clusterArmarios.removeLayer(armarios[i].marker); armarios.splice(i,1); }
  }else if(d.tipo==='poste'){
    [...ctos.filter(c=>c.parentId===d.id),...emendas.filter(e=>e.parentId===d.id),...derivs.filter(dv=>dv.parentId===d.id)].forEach(sub=>doRemove(sub));
    const i=postes.findIndex(p=>p.id===d.id);
    if(i>=0){ clusterPostes.removeLayer(postes[i].marker); postes.splice(i,1); }
  }else if(d.tipo==='olt'){
    const i=olts.findIndex(p=>p.id===d.id);
    if(i>=0)olts.splice(i,1);
    if(d.parentId){const parent=armarios.find(p=>p.id===d.parentId);if(parent){parent.children=parent.children.filter(c=>c.id!==d.id);refreshArmarioIcon(parent);}}
  }else if(d.tipo==='cto'){
    const i=ctos.findIndex(p=>p.id===d.id);
    if(i>=0)ctos.splice(i,1);
    if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){parent.children=parent.children.filter(c=>c.id!==d.id);refreshPosteIcon(parent);}}
  }else if(d.tipo==='emenda'){
    const i=emendas.findIndex(p=>p.id===d.id);
    if(i>=0)emendas.splice(i,1);
    if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){parent.children=parent.children.filter(c=>c.id!==d.id);refreshPosteIcon(parent);}}
  }else if(d.tipo==='deriv'){
    const i=derivs.findIndex(p=>p.id===d.id);
    if(i>=0)derivs.splice(i,1);
    if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){parent.children=parent.children.filter(c=>c.id!==d.id);refreshPosteIcon(parent);}}
  }else if(d.tipo==='cabo'){
    const i=cabos.findIndex(p=>p.id===d.id);
    if(i>=0){ map.removeLayer(cabos[i].poly); cabos.splice(i,1); }
  }
  if(selectedElem&&selectedElem.id===d.id) selectedElem=null;
  updStats();debouncedUpdList();updCableLegend();closeEmModal();
  scheduleAutosave();
}

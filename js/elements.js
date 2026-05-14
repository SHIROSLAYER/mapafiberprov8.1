// ═══════════════════════════════════════════════
// elements.js — Adicionar e Remover Elementos
// ═══════════════════════════════════════════════

// ═══════ ADICIONAR / REMOVER ELEMENTOS ═══════
function addArmario(lat,lng,opts={}){
  armcnt++;const num=opts.num||armcnt,id='ARM-'+String(num).padStart(2,'0');
  const nome=opts.nome||`Armário ${num}`;
  const d={id,num,lat,lng,tipo:'armario',nome:nome,capacidade:opts.capacidade||24,obs:opts.obs||'',children:[],fibers:{connections:[],splitters:[],diagramPositions:{}}};
  const mk = L.marker([lat,lng], {icon: armarioIcon, draggable: true});
  d.marker = mk;
  clusterArmarios.addLayer(mk);
  armarios.push(d);
  mk.on('click',e=>{L.DomEvent.stopPropagation(e);handleElemClick(d);});
  bindDblTap(mk,()=>openEmModal(d));
  mk.on('dragstart',()=>{d._pLat=d.lat;d._pLng=d.lng;});
  mk.on('dragend',()=>confirmMove(d));
  updStats();debouncedUpdList();scheduleAutosave();
  if(!opts._restoring) stateManager.pushState('Criar Armário');
  return d;
}

function addPoste(lat,lng,opts={}){
  pcnt++;const num=opts.num||pcnt,id='P'+num;
  const nome=opts.nome||`Poste ${num}`;
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
    oltcnt++;const num=opts.num||oltcnt,id='OLT-'+String(num).padStart(2,'0');
    const nome=opts.nome||id;
    d={id,num,lat,lng,tipo:'olt',nome:nome,portas:opts.portas||16,parentId:parent.id,obs:opts.obs||'',fibers:{connections:[],diagramPositions:{}}};
    olts.push(d);
  }else if(tipo==='cto'){
    ctocnt++;const num=opts.num||ctocnt,id='CTO-'+String(num).padStart(2,'0');
    const nome=opts.nome||id;
    d={id,num,lat,lng,tipo:'cto',nome:nome,portas:opts.portas||8,splitter:opts.splitter||null,parentId:parent.id,obs:opts.obs||'',fibers:{connections:[],splitters:[],diagramPositions:{}}};
    ctos.push(d);
  }else if(tipo==='emenda'){
    emcnt++;const num=opts.num||emcnt,id='E'+String(num).padStart(2,'0');
    const nome=opts.nome||('Emenda '+id);
    d={id,num,lat,lng,tipo:'emenda',nome:nome,bandejas:opts.bandejas||12,parentId:parent.id,obs:opts.obs||'',fibers:{connections:[],splitters:[],diagramPositions:{}}};
    emendas.push(d);
  }else if(tipo==='deriv'){
    dcnt++;const num=opts.num||dcnt,id='D'+String(num).padStart(2,'0');
    const nome=opts.nome||('Derivação '+id);
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

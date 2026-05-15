// ═══════════════════════════════════════════════
// persistence.js — Salvamento, Exportação e Importação de Projetos
// ═══════════════════════════════════════════════

// ═══════ LIMPAR / IMPORTAÇÃO / EXPORTAÇÃO / PERSISTÊNCIA ═══════
function askClear(){
  // Usa confirmação reforçada (features.js) que pede pra digitar "LIMPAR"
  if(typeof askClearStrong==='function')return askClearStrong();
  // Fallback legado
  showConf('Limpar tudo?','Remove todos os elementos, cabos e conexões.',()=>{
    stateManager.pushState('Limpar Tudo');
    armarios.forEach(p=>clusterArmarios.removeLayer(p.marker));armarios=[];
    postes.forEach(p=>clusterPostes.removeLayer(p.marker));postes=[];
    ctos=[];emendas=[];derivs=[];olts=[];
    cabos.forEach(c=>map.removeLayer(c.poly));cabos=[];
    connections.forEach(c=>map.removeLayer(c.line));connections=[];
    cleanupCabo();pcnt=0;ctocnt=0;emcnt=0;dcnt=0;cabocnt=0;oltcnt=0;armcnt=0;selectedElem=null;
    updStats();debouncedUpdList();updCableLegend();saveProjectToLocal();
  });
}

function loadKML(evt){
  const file=evt.target.files[0];if(!file)return;evt.target.value='';
  const isZ=file.name.toLowerCase().endsWith('.kmz');
  if(isZ){
    const r=new FileReader();
    r.onload=async e=>{try{const z=await JSZip.loadAsync(e.target.result);let t=null;for(const n of Object.keys(z.files))if(n.toLowerCase().endsWith('.kml')){t=await z.files[n].async('text');break;}if(!t){alert('Sem KML no KMZ.');return;}parseKML(t);}catch(er){alert('Erro KMZ:\n'+er.message);}};
    r.readAsArrayBuffer(file);
  }else{
    const r=new FileReader();
    r.onload=e=>parseKML(e.target.result);
    r.readAsText(file);
  }
}

function parseKML(txt){
  try{
    const xml=new DOMParser().parseFromString(txt,'text/xml');
    const pms=xml.querySelectorAll('Placemark');let cnt=0;const bounds=[];
    pms.forEach(pm=>{
      const coords=pm.querySelector('coordinates');
      const name=(pm.querySelector('name')||{}).textContent||'';
      if(!coords)return;
      const parts=coords.textContent.trim().split(/\s+/).filter(Boolean);
      if(parts.length===1){
        const[lng,lat]=parts[0].split(',').map(Number);const nl=name.toLowerCase();
        if(nl.includes('olt'))addSubElement('olt',armarios[0]||addArmario(lat,lng),{nome:name,_restoring:true});
        else if(nl.includes('armario')||nl.includes('armário'))addArmario(lat,lng,{nome:name,_restoring:true});
        else if(nl.includes('cto'))addSubElement('cto',postes[0]||addPoste(lat,lng),{nome:name,_restoring:true});
        else if(nl.includes('deriv'))addSubElement('deriv',postes[0]||addPoste(lat,lng),{nome:name,_restoring:true});
        else if(nl.includes('ceo')||nl.includes('emenda'))addSubElement('emenda',postes[0]||addPoste(lat,lng),{nome:name,_restoring:true});
        else addPoste(lat,lng,{nome:name,_restoring:true});
        bounds.push([lat,lng]);cnt++;
      }else if(parts.length>=2){
        const pts=parts.map(p=>{const c=p.split(',');return[parseFloat(c[1]),parseFloat(c[0])];});
        let typeId='fo-12';const nl=name.toLowerCase();
        if(nl.includes('72'))typeId='fo-72';else if(nl.includes('36'))typeId='fo-36';else if(nl.includes('8'))typeId='fo-8';
        const ct=CABLE_TYPES.find(c=>c.id===typeId)||CABLE_TYPES[1];
        cabocnt++;let id='Cabo-'+String(cabocnt).padStart(2,'0');
        if(typeof uniqueId==='function')id=uniqueId(id);
        let nome=name||id;
        if(typeof uniqueName==='function')nome=uniqueName(nome);
        const dist=calcDist(pts);const poly=L.polyline(pts,{color:ct.color,weight:4,opacity:.9}).addTo(map);
        const dd={id,tipo:'cabo',points:pts,grupos:ct.grupos,fpg:ct.fpg,total:ct.grupos*ct.fpg,estilo:ct.estilo,color:ct.color,typeId,typeName:ct.name,dist,nome,obs:'',anchors:[],anchorMap:{},fibers:{connections:[],splitters:[],diagramPositions:{}}};
        dd.poly=poly;cabos.push(dd);
        poly.on('click',e=>{L.DomEvent.stopPropagation(e);selectedElem=dd;});
        bindDblTap(poly,()=>openEmModal(dd));
        pts.forEach(p=>bounds.push(p));cnt++;
      }
    });
    if(bounds.length)map.fitBounds(L.latLngBounds(bounds),{padding:[40,40]});
    autoAnchorCabos();
    if(typeof dedupeProject==='function')dedupeProject();
    if(typeof autoNameAllDerivs==='function')autoNameAllDerivs();
    if(typeof refreshAllPosteIcons==='function')refreshAllPosteIcons();
    updStats();debouncedUpdList();updCableLegend();scheduleAutosave();
    showToast(`Importado! ${cnt} elementos carregados.`);
  }catch(er){alert('Erro KML:\n'+er.message);}
}

function exportGeoJSON(){
  const f=[];
  armarios.forEach(p=>f.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{tipo:'armario',id:p.id,nome:p.nome}}));
  postes.forEach(p=>f.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{tipo:'poste',id:p.id,nome:p.nome}}));
  olts.forEach(p=>f.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{tipo:'olt',id:p.id,nome:p.nome,portas:p.portas}}));
  ctos.forEach(p=>f.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{tipo:'cto',id:p.id,nome:p.nome,portas:p.portas}}));
  emendas.forEach(p=>f.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{tipo:'emenda',id:p.id,nome:p.nome,bandejas:p.bandejas}}));
  derivs.forEach(p=>f.push({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{tipo:'deriv',id:p.id,nome:p.nome}}));
  cabos.forEach(c=>f.push({type:'Feature',geometry:{type:'LineString',coordinates:c.points.map(p=>[p[1],p[0]])},properties:{tipo:'cabo',id:c.id,total:c.total,dist_m:c.dist,anchors:c.anchors}}));
  connections.forEach(c=>f.push({type:'Feature',geometry:{type:'LineString',coordinates:[[c.a.lng,c.a.lat],[c.b.lng,c.b.lat]]},properties:{tipo:'conexao',de:c.a.id,para:c.b.id}}));
  const blob=new Blob([JSON.stringify({type:'FeatureCollection',features:f},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rede_fibra.geojson';a.click();URL.revokeObjectURL(a.href);
}

async function exportKMZ(){
  if(typeof JSZip==='undefined'){alert('JSZip não carregado.');return;}
  let k=`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>FiberMap Pro v8.4</name>\n`;
  armarios.forEach(p=>k+=`<Placemark><name>${p.nome}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>\n`);
  postes.forEach(p=>k+=`<Placemark><name>${p.nome}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>\n`);
  olts.forEach(p=>k+=`<Placemark><name>${p.nome}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>\n`);
  ctos.forEach(p=>k+=`<Placemark><name>${p.nome}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>\n`);
  emendas.forEach(p=>k+=`<Placemark><name>${p.nome}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>\n`);
  derivs.forEach(p=>k+=`<Placemark><name>${p.nome}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>\n`);
  cabos.forEach(c=>{const co=c.points.map(p=>`${p[1]},${p[0]},0`).join('\n');const rgb=c.color.replace('#','');const r=rgb.slice(0,2),g=rgb.slice(2,4),b=rgb.slice(4,6);k+=`<Placemark><name>${c.nome}</name><Style><LineStyle><color>ff${b}${g}${r}</color><width>3</width></LineStyle></Style><LineString><tessellate>1</tessellate><coordinates>${co}</coordinates></LineString></Placemark>\n`;});
  k+=`</Document></kml>`;
  const z=new JSZip();z.file('doc.kml',k);
  const blob=await z.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rede_fibra.kmz';a.click();URL.revokeObjectURL(a.href);
}

function autoAnchorCabos(){
  const elems=[...postes,...armarios];
  cabos.forEach(c=>{
    c.anchors=[];
    c.anchorMap={};
    c.points.forEach((pt,idx)=>{
      const nearest=elems.find(e=>map.distance(L.latLng(pt[0],pt[1]),L.latLng(e.lat,e.lng))<=20);
      if(nearest){
        c.anchorMap[idx]=nearest.id;
        if(!c.anchors.includes(nearest.id))c.anchors.push(nearest.id);
      }
    });
  });
}

const PROJECT_STORAGE_KEY='fibermap.v8.project';
function buildProjectSnapshot(){
  return {
    version:8.4,
    counters:{pcnt,ctocnt,emcnt,dcnt,cabocnt,oltcnt,armcnt},
    armarios:armarios.map(a=>({id:a.id,num:a.num,lat:a.lat,lng:a.lng,tipo:a.tipo,nome:a.nome,obs:a.obs,capacidade:a.capacidade,children:a.children,fibers:a.fibers})),
    postes:postes.map(p=>({id:p.id,num:p.num,lat:p.lat,lng:p.lng,tipo:p.tipo,nome:p.nome,obs:p.obs,children:p.children,fibers:p.fibers})),
    olts:olts.map(o=>({id:o.id,num:o.num,lat:o.lat,lng:o.lng,tipo:o.tipo,nome:o.nome,portas:o.portas,parentId:o.parentId,obs:o.obs,fibers:o.fibers})),
    ctos:ctos.map(c=>({id:c.id,num:c.num,lat:c.lat,lng:c.lng,tipo:c.tipo,nome:c.nome,obs:c.obs,portas:c.portas,splitter:c.splitter,parentId:c.parentId,fibers:c.fibers})),
    emendas:emendas.map(c=>({id:c.id,num:c.num,lat:c.lat,lng:c.lng,tipo:c.tipo,nome:c.nome,obs:c.obs,bandejas:c.bandejas,parentId:c.parentId,fibers:c.fibers})),
    derivs:derivs.map(d=>({id:d.id,num:d.num,lat:d.lat,lng:d.lng,tipo:d.tipo,nome:d.nome,obs:d.obs,capacidade:d.capacidade,splitter:d.splitter,parentId:d.parentId,fibers:d.fibers||{connections:[],splitters:[],diagramPositions:{}}})),
    cabos:cabos.map(c=>({id:c.id,tipo:c.tipo,points:c.points,grupos:c.grupos,fpg:c.fpg,total:c.total,estilo:c.estilo,color:c.color,typeId:c.typeId,typeName:c.typeName,dist:c.dist,nome:c.nome,obs:c.obs,anchors:c.anchors,anchorMap:c.anchorMap,fibers:c.fibers})),
    connections:connections.map(c=>({aId:c.a.id,bId:c.b.id}))
  };
}
// ═══ Project storage: IndexedDB (sem limite 5MB) com fallback localStorage ═══
const PROJECT_DB='fibermap-project',PROJECT_STORE='project';
let _projDb=null;
function openProjectDB(){
  return new Promise((resolve,reject)=>{
    if(_projDb)return resolve(_projDb);
    if(!window.indexedDB)return reject(new Error('IndexedDB indisponível'));
    const req=indexedDB.open(PROJECT_DB,1);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains(PROJECT_STORE))db.createObjectStore(PROJECT_STORE);
    };
    req.onsuccess=e=>{_projDb=e.target.result;resolve(_projDb);};
    req.onerror=e=>reject(e.target.error);
  });
}
async function saveProjectToIDB(snap){
  const db=await openProjectDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([PROJECT_STORE],'readwrite');
    tx.objectStore(PROJECT_STORE).put(snap,'current');
    tx.oncomplete=()=>resolve(true);
    tx.onerror=e=>reject(e.target.error);
  });
}
async function loadProjectFromIDB(){
  try{
    const db=await openProjectDB();
    return new Promise(resolve=>{
      const tx=db.transaction([PROJECT_STORE],'readonly');
      const req=tx.objectStore(PROJECT_STORE).get('current');
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>resolve(null);
    });
  }catch(e){return null;}
}

function saveProjectToLocal(){
  try{
    showSavingIndicator(true);
    const snap=buildProjectSnapshot();
    // Tenta IndexedDB primeiro (sem limite)
    saveProjectToIDB(snap).catch(err=>console.warn('IDB save falhou, usando localStorage:',err));
    // Backup em localStorage também (até 5MB) — pra carregamento síncrono na inicialização
    try{
      const str=JSON.stringify(snap);
      if(str.length<4500000)localStorage.setItem(PROJECT_STORAGE_KEY,str);
    }catch(e){/* tudo bem se ultrapassar */}
    scheduleAutoBackup();
    setTimeout(()=>showSavingIndicator(false),300);
  }catch(e){
    showToast('⚠ Falha ao salvar: '+(e.message||e),'error');
    showSavingIndicator(false);
  }
}

// ═══════ AUTO-BACKUP (IndexedDB com snapshots datados) ═══════
const BACKUP_DB='fibermap-backups',BACKUP_STORE='snapshots',BACKUP_MAX=20;
let _backupTimer=null,_backupDb=null;
function openBackupDB(){
  return new Promise((resolve,reject)=>{
    if(_backupDb)return resolve(_backupDb);
    const req=indexedDB.open(BACKUP_DB,1);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains(BACKUP_STORE)){
        const st=db.createObjectStore(BACKUP_STORE,{keyPath:'id',autoIncrement:true});
        st.createIndex('ts','ts',{unique:false});
      }
    };
    req.onsuccess=e=>{_backupDb=e.target.result;resolve(_backupDb);};
    req.onerror=e=>reject(e.target.error);
  });
}
function scheduleAutoBackup(){
  clearTimeout(_backupTimer);
  _backupTimer=setTimeout(doAutoBackup,8000);
}
async function doAutoBackup(){
  try{
    const db=await openBackupDB();
    const snap=buildProjectSnapshot();
    const stats={
      elements:(armarios.length+postes.length+ctos.length+emendas.length+derivs.length+olts.length),
      cables:cabos.length,
      totalM:Math.round(cabos.reduce((a,c)=>a+(c.dist||0),0))
    };
    const tx=db.transaction([BACKUP_STORE],'readwrite');
    const st=tx.objectStore(BACKUP_STORE);
    st.add({ts:Date.now(),stats:stats,data:snap});
    // Mantém só os últimos N
    const all=[];
    st.openCursor().onsuccess=e=>{
      const cur=e.target.result;
      if(cur){all.push({id:cur.value.id,ts:cur.value.ts});cur.continue();}
      else{
        all.sort((a,b)=>a.ts-b.ts);
        while(all.length>BACKUP_MAX){
          const old=all.shift();
          st.delete(old.id);
        }
      }
    };
  }catch(e){console.warn('Backup falhou:',e);}
}
async function listBackups(){
  try{
    const db=await openBackupDB();
    return new Promise(resolve=>{
      const list=[];
      const tx=db.transaction([BACKUP_STORE],'readonly');
      const cur=tx.objectStore(BACKUP_STORE).openCursor(null,'prev');
      cur.onsuccess=e=>{
        const c=e.target.result;
        if(c){list.push({id:c.value.id,ts:c.value.ts,stats:c.value.stats});c.continue();}
        else resolve(list);
      };
      cur.onerror=()=>resolve([]);
    });
  }catch(e){return [];}
}
async function restoreBackup(id){
  try{
    const db=await openBackupDB();
    return new Promise(resolve=>{
      const tx=db.transaction([BACKUP_STORE],'readonly');
      const req=tx.objectStore(BACKUP_STORE).get(id);
      req.onsuccess=e=>{
        const rec=e.target.result;
        if(rec&&rec.data){
          applyProjectSnapshot(rec.data);
          saveProjectToLocal();
          showToast('✓ Backup restaurado','success');
          resolve(true);
        }else{resolve(false);}
      };
      req.onerror=()=>resolve(false);
    });
  }catch(e){return false;}
}
async function showBackupsModal(){
  const backups=await listBackups();
  const ov=document.getElementById('backups-overlay')||(()=>{
    const d=document.createElement('div');d.id='backups-overlay';
    d.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9700;align-items:center;justify-content:center;padding:16px';
    d.addEventListener('click',e=>{if(e.target===d)closeBackupsModal();});
    document.body.appendChild(d);return d;
  })();
  let rows='';
  if(!backups.length)rows='<div style="padding:20px;text-align:center;color:var(--text3);font-family:var(--mono);font-size:12px">Nenhum backup ainda. Faça alterações para gerar.</div>';
  else backups.forEach(b=>{
    const d=new Date(b.ts);
    const dStr=d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    rows+=`<div class="bk-row"><div class="bk-info"><b>${dStr}</b><span class="bk-stats">${b.stats.elements} elem · ${b.stats.cables} cabos · ${b.stats.totalM}m</span></div><button class="cm-btn primary" onclick="onRestoreBackup(${b.id})">Restaurar</button></div>`;
  });
  ov.innerHTML='<div class="bk-modal"><div class="bk-hdr"><h3>💾 Backups automáticos</h3><p>Salvos no navegador (IndexedDB). Os '+BACKUP_MAX+' mais recentes ficam guardados.</p><button class="cc-close" onclick="closeBackupsModal()">✕</button></div><div class="bk-list">'+rows+'</div></div>';
  ov.style.display='flex';
}
function closeBackupsModal(){const ov=document.getElementById('backups-overlay');if(ov)ov.style.display='none';}
function onRestoreBackup(id){
  showConf('Restaurar backup?','Isso substitui o projeto atual pelo backup selecionado. Os dados atuais serão perdidos (a menos que faça download antes).',
    async()=>{await restoreBackup(id);closeBackupsModal();},null,'gn');
}

function showSavingIndicator(on){
  const el=document.getElementById('sb-autosave');
  if(!el)return;
  if(on){el.textContent='● Salvando…';el.style.color='var(--amber)';}
  else{el.textContent='● Sincronizado';el.style.color='';}
}
function loadProjectFromLocal(){
  // Sincronicamente tenta localStorage primeiro (rápido na inicialização)
  // Async tenta IndexedDB depois (mais robusto, sem limite). Se IDB tem mais novo, recarrega.
  setTimeout(async()=>{
    try{
      const idbSnap=await loadProjectFromIDB();
      if(idbSnap&&idbSnap.counters){
        // Se já carregou de localStorage, só substitui se IDB tem MAIS elementos (mais recente)
        const lsCount=(armarios.length+postes.length+cabos.length);
        const idbCount=((idbSnap.armarios||[]).length+(idbSnap.postes||[]).length+(idbSnap.cabos||[]).length);
        if(idbCount>lsCount){
          console.info('IDB tem mais dados, restaurando');
          applyProjectSnapshot(idbSnap);
        }
      }
    }catch(e){console.warn('IDB load falhou:',e);}
  },500);
  try{
    const raw=localStorage.getItem(PROJECT_STORAGE_KEY);
    if(!raw)return false;
    const snap=JSON.parse(raw);
    clusterPostes.clearLayers(); clusterArmarios.clearLayers();
    armarios.forEach(p=>clusterArmarios.removeLayer(p.marker));armarios=[];
    postes.forEach(p=>clusterPostes.removeLayer(p.marker));postes=[];
    ctos=[];emendas=[];derivs=[];olts=[];
    cabos.forEach(c=>map.removeLayer(c.poly));cabos=[];
    connections.forEach(c=>map.removeLayer(c.line));connections=[];
    cleanupCabo();
    ctocnt=snap.counters.ctocnt;emcnt=snap.counters.emcnt;dcnt=snap.counters.dcnt;cabocnt=snap.counters.cabocnt;oltcnt=snap.counters.oltcnt;
    (snap.armarios||[]).forEach(a=>{const d=addArmario(a.lat,a.lng,{id:a.id,num:a.num,nome:a.nome,obs:a.obs,capacidade:a.capacidade,_restoring:true});d.children=[];d.fibers=a.fibers||{connections:[],splitters:[],diagramPositions:{}};refreshArmarioIcon(d);});
    (snap.postes||[]).forEach(p=>{const d=addPoste(p.lat,p.lng,{id:p.id,num:p.num,nome:p.nome,obs:p.obs,_restoring:true});d.children=[];d.fibers=p.fibers||{connections:[],splitters:[],diagramPositions:{}};refreshPosteIcon(d);});
    pcnt=snap.counters.pcnt;armcnt=snap.counters.armcnt;
    (snap.olts||[]).forEach(o=>{oltcnt=Math.max(oltcnt,o.num);const d={...o,fibers:o.fibers||{connections:[],diagramPositions:{}}};olts.push(d);if(d.parentId){const parent=armarios.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'olt',id:d.id});refreshArmarioIcon(parent);}}});
    (snap.ctos||[]).forEach(c=>{ctocnt=Math.max(ctocnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};ctos.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'cto',id:d.id});refreshPosteIcon(parent);}}});
    (snap.emendas||[]).forEach(c=>{emcnt=Math.max(emcnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};emendas.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'emenda',id:d.id});refreshPosteIcon(parent);}}});
    (snap.derivs||[]).forEach(c=>{dcnt=Math.max(dcnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};derivs.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'deriv',id:d.id});refreshPosteIcon(parent);}}});
    (snap.cabos||[]).forEach(c=>{const poly=L.polyline(c.points,{color:c.color,weight:4,opacity:.9}).addTo(map);const dd={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}},poly};cabos.push(dd);poly.on('click',e=>{L.DomEvent.stopPropagation(e);selectedElem=dd;showCablePopup(dd,e.latlng);});bindDblTap(poly,e=>openCableAtClick(dd,e));});
    (snap.connections||[]).forEach(cc=>{const a=findById(cc.aId),b=findById(cc.bId);if(a&&b){const line=L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{color:'#8b949e',weight:1.5,dashArray:'6,4',opacity:.7}).addTo(map);connections.push({a,b,line});}});
    autoAnchorCabos();
    if(typeof dedupeProject==='function')dedupeProject();
    if(typeof autoNameAllDerivs==='function')autoNameAllDerivs();
    if(typeof refreshAllPosteIcons==='function')refreshAllPosteIcons();
    updStats();debouncedUpdList();updCableLegend();
    return true;
  }catch(e){return false;}
}
function downloadProjectJSON(){
  const blob=new Blob([JSON.stringify(buildProjectSnapshot(),null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='projeto_v8.json';a.click();URL.revokeObjectURL(a.href);
}
function importProjectFile(evt){
  const file=evt.target.files[0];if(!file)return;evt.target.value='';
  const r=new FileReader();
  r.onload=e=>{try{const snap=JSON.parse(e.target.result);applyProjectSnapshot(snap);saveProjectToLocal();showToast('✓ Projeto importado','success');}catch(er){showToast('✗ Erro ao importar','error');}};
  r.readAsText(file);
}
function applyProjectSnapshot(snap){
  clusterPostes.clearLayers(); clusterArmarios.clearLayers();
  armarios.forEach(p=>clusterArmarios.removeLayer(p.marker));armarios=[];
  postes.forEach(p=>clusterPostes.removeLayer(p.marker));postes=[];
  ctos=[];emendas=[];derivs=[];olts=[];
  cabos.forEach(c=>map.removeLayer(c.poly));cabos=[];
  connections.forEach(c=>map.removeLayer(c.line));connections=[];
  cleanupCabo();
  ctocnt=snap.counters.ctocnt;emcnt=snap.counters.emcnt;dcnt=snap.counters.dcnt;cabocnt=snap.counters.cabocnt;oltcnt=snap.counters.oltcnt;
  (snap.armarios||[]).forEach(a=>{const d=addArmario(a.lat,a.lng,{id:a.id,num:a.num,nome:a.nome,obs:a.obs,capacidade:a.capacidade,_restoring:true});d.children=[];d.fibers=a.fibers||{connections:[],splitters:[],diagramPositions:{}};refreshArmarioIcon(d);});
  (snap.postes||[]).forEach(p=>{const d=addPoste(p.lat,p.lng,{id:p.id,num:p.num,nome:p.nome,obs:p.obs,_restoring:true});d.children=[];d.fibers=p.fibers||{connections:[],splitters:[],diagramPositions:{}};refreshPosteIcon(d);});
  pcnt=snap.counters.pcnt;armcnt=snap.counters.armcnt;
  (snap.olts||[]).forEach(o=>{oltcnt=Math.max(oltcnt,o.num);const d={...o,fibers:o.fibers||{connections:[],diagramPositions:{}}};olts.push(d);if(d.parentId){const parent=armarios.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'olt',id:d.id});refreshArmarioIcon(parent);}}});
  (snap.ctos||[]).forEach(c=>{ctocnt=Math.max(ctocnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};ctos.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'cto',id:d.id});refreshPosteIcon(parent);}}});
  (snap.emendas||[]).forEach(c=>{emcnt=Math.max(emcnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};emendas.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'emenda',id:d.id});refreshPosteIcon(parent);}}});
  (snap.derivs||[]).forEach(c=>{dcnt=Math.max(dcnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};derivs.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'deriv',id:d.id});refreshPosteIcon(parent);}}});
  (snap.cabos||[]).forEach(c=>{const poly=L.polyline(c.points,{color:c.color,weight:4,opacity:.9}).addTo(map);const dd={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}},poly};cabos.push(dd);poly.on('click',e=>{L.DomEvent.stopPropagation(e);selectedElem=dd;showCablePopup(dd,e.latlng);});bindDblTap(poly,e=>openCableAtClick(dd,e));});
  (snap.connections||[]).forEach(cc=>{const a=findById(cc.aId),b=findById(cc.bId);if(a&&b){const line=L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{color:'#8b949e',weight:1.5,dashArray:'6,4',opacity:.7}).addTo(map);connections.push({a,b,line});}});
  autoAnchorCabos();
  if(typeof dedupeProject==='function')dedupeProject();
  updStats();debouncedUpdList();updCableLegend();
}


// ═══════════════════════════════════════════════
// persistence.js — Salvamento, Exportação e Importação de Projetos
// ═══════════════════════════════════════════════

// ═══════ LIMPAR / IMPORTAÇÃO / EXPORTAÇÃO / PERSISTÊNCIA ═══════
function askClear(){
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
        cabocnt++;const id='Cabo-'+String(cabocnt).padStart(2,'0');
        const dist=calcDist(pts);const poly=L.polyline(pts,{color:ct.color,weight:4,opacity:.9}).addTo(map);
        const dd={id,tipo:'cabo',points:pts,grupos:ct.grupos,fpg:ct.fpg,total:ct.grupos*ct.fpg,estilo:ct.estilo,color:ct.color,typeId,typeName:ct.name,dist,nome:name||id,obs:'',anchors:[],anchorMap:{},fibers:{connections:[],splitters:[],diagramPositions:{}}};
        dd.poly=poly;cabos.push(dd);
        poly.on('click',e=>{L.DomEvent.stopPropagation(e);selectedElem=dd;});
        bindDblTap(poly,()=>openEmModal(dd));
        pts.forEach(p=>bounds.push(p));cnt++;
      }
    });
    if(bounds.length)map.fitBounds(L.latLngBounds(bounds),{padding:[40,40]});
    autoAnchorCabos();
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
function saveProjectToLocal(){try{localStorage.setItem(PROJECT_STORAGE_KEY,JSON.stringify(buildProjectSnapshot()));}catch(e){}}
function loadProjectFromLocal(){
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
    (snap.armarios||[]).forEach(a=>{const d=addArmario(a.lat,a.lng,{num:a.num,nome:a.nome,obs:a.obs,capacidade:a.capacidade,_restoring:true});d.children=[];d.fibers=a.fibers||{connections:[],splitters:[],diagramPositions:{}};refreshArmarioIcon(d);});
    (snap.postes||[]).forEach(p=>{const d=addPoste(p.lat,p.lng,{num:p.num,nome:p.nome,obs:p.obs,_restoring:true});d.children=[];d.fibers=p.fibers||{connections:[],splitters:[],diagramPositions:{}};refreshPosteIcon(d);});
    pcnt=snap.counters.pcnt;armcnt=snap.counters.armcnt;
    (snap.olts||[]).forEach(o=>{oltcnt=Math.max(oltcnt,o.num);const d={...o,fibers:o.fibers||{connections:[],diagramPositions:{}}};olts.push(d);if(d.parentId){const parent=armarios.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'olt',id:d.id});refreshArmarioIcon(parent);}}});
    (snap.ctos||[]).forEach(c=>{ctocnt=Math.max(ctocnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};ctos.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'cto',id:d.id});refreshPosteIcon(parent);}}});
    (snap.emendas||[]).forEach(c=>{emcnt=Math.max(emcnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};emendas.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'emenda',id:d.id});refreshPosteIcon(parent);}}});
    (snap.derivs||[]).forEach(c=>{dcnt=Math.max(dcnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};derivs.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'deriv',id:d.id});refreshPosteIcon(parent);}}});
    (snap.cabos||[]).forEach(c=>{const poly=L.polyline(c.points,{color:c.color,weight:4,opacity:.9}).addTo(map);const dd={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}},poly};cabos.push(dd);poly.on('click',e=>{L.DomEvent.stopPropagation(e);selectedElem=dd;showCablePopup(dd,e.latlng);});bindDblTap(poly,()=>openEmModal(dd));});
    (snap.connections||[]).forEach(cc=>{const a=findById(cc.aId),b=findById(cc.bId);if(a&&b){const line=L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{color:'#8b949e',weight:1.5,dashArray:'6,4',opacity:.7}).addTo(map);connections.push({a,b,line});}});
    autoAnchorCabos();
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
  (snap.armarios||[]).forEach(a=>{const d=addArmario(a.lat,a.lng,{num:a.num,nome:a.nome,obs:a.obs,capacidade:a.capacidade,_restoring:true});d.children=[];d.fibers=a.fibers||{connections:[],splitters:[],diagramPositions:{}};refreshArmarioIcon(d);});
  (snap.postes||[]).forEach(p=>{const d=addPoste(p.lat,p.lng,{num:p.num,nome:p.nome,obs:p.obs,_restoring:true});d.children=[];d.fibers=p.fibers||{connections:[],splitters:[],diagramPositions:{}};refreshPosteIcon(d);});
  pcnt=snap.counters.pcnt;armcnt=snap.counters.armcnt;
  (snap.olts||[]).forEach(o=>{oltcnt=Math.max(oltcnt,o.num);const d={...o,fibers:o.fibers||{connections:[],diagramPositions:{}}};olts.push(d);if(d.parentId){const parent=armarios.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'olt',id:d.id});refreshArmarioIcon(parent);}}});
  (snap.ctos||[]).forEach(c=>{ctocnt=Math.max(ctocnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};ctos.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'cto',id:d.id});refreshPosteIcon(parent);}}});
  (snap.emendas||[]).forEach(c=>{emcnt=Math.max(emcnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};emendas.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'emenda',id:d.id});refreshPosteIcon(parent);}}});
  (snap.derivs||[]).forEach(c=>{dcnt=Math.max(dcnt,c.num);const d={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}}};derivs.push(d);if(d.parentId){const parent=postes.find(p=>p.id===d.parentId);if(parent){if(!parent.children)parent.children=[];parent.children.push({tipo:'deriv',id:d.id});refreshPosteIcon(parent);}}});
  (snap.cabos||[]).forEach(c=>{const poly=L.polyline(c.points,{color:c.color,weight:4,opacity:.9}).addTo(map);const dd={...c,fibers:c.fibers||{connections:[],splitters:[],diagramPositions:{}},poly};cabos.push(dd);poly.on('click',e=>{L.DomEvent.stopPropagation(e);selectedElem=dd;showCablePopup(dd,e.latlng);});bindDblTap(poly,()=>openEmModal(dd));});
  (snap.connections||[]).forEach(cc=>{const a=findById(cc.aId),b=findById(cc.bId);if(a&&b){const line=L.polyline([[a.lat,a.lng],[b.lat,b.lng]],{color:'#8b949e',weight:1.5,dashArray:'6,4',opacity:.7}).addTo(map);connections.push({a,b,line});}});
  autoAnchorCabos();
  updStats();debouncedUpdList();updCableLegend();
}


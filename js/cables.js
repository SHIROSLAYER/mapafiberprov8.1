// ═══════════════════════════════════════════════
// cables.js — Traçado, Ancoragem e Gestão de Cabos
// ═══════════════════════════════════════════════

// ═══════ CORES RECENTES ═══════
const RECENT_COLORS_KEY='fibermap-recent-colors';
const MAX_RECENT=8;

function getRecentColors(){
  try{return JSON.parse(localStorage.getItem(RECENT_COLORS_KEY))||[];}catch{return[];}
}
function saveRecentColor(hex){
  const list=getRecentColors().filter(c=>c!==hex);
  list.unshift(hex);
  localStorage.setItem(RECENT_COLORS_KEY,JSON.stringify(list.slice(0,MAX_RECENT)));
  renderRecentColors('cm-recent-colors','cm-color');
  renderRecentColors('alterar-cm-recent-colors','alterar-cm-color');
}
function setRecentColor(inputId,hex){
  const inp=document.getElementById(inputId);
  if(!inp)return;
  inp.value=hex;
  if(inputId==='cm-color')updateFiberPreview();
}
function renderRecentColors(containerId,inputId){
  const el=document.getElementById(containerId);
  if(!el)return;
  const list=getRecentColors();
  if(!list.length){el.style.display='none';return;}
  el.style.display='block';
  el.innerHTML=`<div class="cm-label" style="margin-bottom:8px">Cores recentes</div>
    <div style="display:flex;flex-wrap:wrap;gap:7px">
      ${list.map(c=>`<div
        class="recent-color-swatch"
        onclick="setRecentColor('${inputId}','${c}')"
        title="${c}"
        style="background:${c}"
      ></div>`).join('')}
    </div>`;
}

// ═══════ CABOS ═══════
let selectedCableTypeId='fo-12';
function buildCableTypeGrid(){
  const grid=document.getElementById('cable-type-grid');
  grid.innerHTML=CABLE_TYPES.map(ct=>`
    <div class="ctb" data-id="${ct.id}" onclick="selectCableType('${ct.id}')">
      <div class="ctb-name" style="color:${ct.color}">${ct.name}</div>
      <div class="ctb-desc">${ct.desc}</div>
    </div>`).join('');
  selectCableType('fo-12');
}
function selectCableType(id){
  selectedCableTypeId=id;
  document.querySelectorAll('.ctb').forEach(b=>b.classList.toggle('sel',b.dataset.id===id));
  const ct=CABLE_TYPES.find(c=>c.id===id);
  const customSection=document.getElementById('cm-custom-section');
  if(id==='custom'){
    customSection.style.display='block';
    if(!document.getElementById('cm-grupos').value)document.getElementById('cm-grupos').value=1;
    if(!document.getElementById('cm-fpg').value)document.getElementById('cm-fpg').value=12;
  }else{
    customSection.style.display='none';
    if(ct){
      document.getElementById('cm-grupos').value=ct.grupos;
      document.getElementById('cm-fpg').value=ct.fpg;
      document.getElementById('cm-estilo').value=ct.estilo;
      document.getElementById('cm-color').value=ct.color;
    }
  }
  const idEl=document.getElementById('cm-id');
  if(!idEl.value){cabocnt++;idEl.value=`Cabo-${String(cabocnt).padStart(2,'0')}`;cabocnt--;}
  updateFiberPreview();
}
function updateFiberPreview(){
  const grupos=parseInt(document.getElementById('cm-grupos').value)||1;
  const fpg=parseInt(document.getElementById('cm-fpg').value)||12;
  const total=grupos*fpg;
  const prev=document.getElementById('fiber-preview');
  let h='';
  for(let i=0;i<Math.min(total,144);i++){
    const a=abntColor(i);
    h+=`<div class="fp-dot" style="background:${a.fiber.hex};border-color:${a.tube.hex};" title="T${a.tubeN} F${a.fiberN} — ${a.fiber.name}"></div>`;
  }
  if(total>144)h+=`<span style="font-size:10px;color:var(--text3);font-family:var(--mono);align-self:center">+${total-144} mais...</span>`;
  prev.innerHTML=h;
  document.getElementById('fp-count').textContent=`${grupos} tubo${grupos>1?'s':''} × ${fpg} fibras = ${total} FO total`;
}
function openCableModal(){
  if(!document.getElementById('cable-type-grid').children.length)buildCableTypeGrid();
  else updateFiberPreview();
  renderRecentColors('cm-recent-colors','cm-color');
  document.getElementById('cable-overlay').classList.add('show');
}
function closeCableModal(){
  document.getElementById('cable-overlay').classList.remove('show');
  if(mode==='cabo'){setMode('select');}
}
function confirmCableModal(){
  const grupos=parseInt(document.getElementById('cm-grupos').value)||1;
  const fpg=parseInt(document.getElementById('cm-fpg').value)||12;
  const estilo=document.getElementById('cm-estilo').value;
  const color=document.getElementById('cm-color').value;
  let idVal=document.getElementById('cm-id').value.trim();
  if(!idVal){cabocnt++;idVal=`Cabo-${String(cabocnt).padStart(2,'0')}`;}
  const ct=CABLE_TYPES.find(c=>c.id===selectedCableTypeId)||CABLE_TYPES[0];
  saveRecentColor(color);
  pendingCable={id:idVal,grupos,fpg,total:grupos*fpg,estilo,color,typeId:selectedCableTypeId,typeName:ct.name,anchors:[]};
  document.getElementById('cable-overlay').classList.remove('show');
  document.getElementById('cable-actions').classList.add('show');
  drawingCabo=true;caboPoints=[];
  document.getElementById('sbm').textContent=`Traçando ${idVal} (${grupos*fpg} FO) — clique em postes/armários para ancorar • Enter=finalizar • Esc=cancelar`;
  highlightAnchorsForCabo(true);
}
function anchorables(){return [...armarios,...postes];}
function highlightAnchorsForCabo(on){
  anchorables().forEach(a=>{
    const el=a.marker.getElement();
    if(el)el.style.filter=on?'drop-shadow(0 0 8px #1D9E75) brightness(1.2)':'';
    if(on){
      a.marker.off('click');
      a._anchorHandler=function(e){L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);anchorCaboToElem(a);};
      a.marker.on('click',a._anchorHandler);
    }else{
      if(a._anchorHandler){a.marker.off('click',a._anchorHandler);a._anchorHandler=null;}
      a.marker.off('click');
      a.marker.on('click',function(e){L.DomEvent.stopPropagation(e);handleElemClick(a);});
    }
  });
}

// ═══════ ANCORAGEM CORRIGIDA ═══════
function anchorCaboToElem(a){
  if(!drawingCabo||!pendingCable)return;
  const lat = a.lat, lng = a.lng;
  caboPoints.push([lat, lng]);
  pendingCable.anchors.push(a.id);
  const color=pendingCable.color||'#1D9E75';
  const dot=L.circleMarker([lat,lng],{radius:6,color:color,fillColor:'#fff',fillOpacity:1,weight:3}).addTo(map);
  tempDots.push(dot);
  document.getElementById('sbm').textContent=`${pendingCable.id} — ${caboPoints.length} pontos (${pendingCable.anchors.length} âncoras) • Enter=finalizar`;
}

function onMapClick(e){
  if(mode==='select')return;
  const{lat,lng}=e.latlng;
  if(mode==='medida'){ addMeasurePoint(lat,lng); return; }
  if(mode==='cabo'&&drawingCabo){
    // Verifica se clicou próximo a um poste/armário (tolerância de 10 metros)
    const clicked = anchorables().find(a => {
      const dist = map.distance(L.latLng(lat,lng), L.latLng(a.lat,a.lng));
      return dist < 10; // 10 metros de tolerância
    });
    if(clicked){
      anchorCaboToElem(clicked);
      return;
    }
    // Ponto livre
    caboPoints.push([lat,lng]);
    const dot=L.circleMarker([lat,lng],{radius:3,color:pendingCable?pendingCable.color:'#1D9E75',fillOpacity:1,weight:1}).addTo(map);
    tempDots.push(dot);
    return;
  }
  if(mode==='armario')addArmario(lat,lng);
  if(mode==='poste')addPoste(lat,lng);
}
function onMapDblClick(e){
  if(mode==='cabo'&&drawingCabo&&caboPoints.length>=2)finishCabo();
}

// ═══════ SIMPLIFICAÇÃO QUE PRESERVA ÂNCORAS ═══════
function simplifyPoints(points, anchorIndices, tolerance) {
  if (points.length < 3) return points;

  const fixed = new Set(anchorIndices);

  function perpDist(p, a, b) {
    const area = Math.abs((b[0]-a[0])*(a[1]-p[1]) - (a[0]-p[0])*(b[1]-a[1]));
    const base = Math.sqrt((b[0]-a[0])**2 + (b[1]-a[1])**2);
    return base === 0 ? 0 : area / base;
  }

  function rdp(pts, start, end, tol) {
    if (end <= start + 1) {
      const result = [pts[start]];
      if (end !== start) result.push(pts[end]);
      return result;
    }
    let maxDist = 0, maxIdx = start;
    const a = pts[start], b = pts[end];
    for (let i = start + 1; i < end; i++) {
      if (fixed.has(i)) continue;
      const dist = perpDist(pts[i], a, b);
      if (dist > maxDist) { maxDist = dist; maxIdx = i; }
    }
    if (maxDist > tol && !fixed.has(maxIdx)) {
      const left = rdp(pts, start, maxIdx, tol);
      const right = rdp(pts, maxIdx, end, tol);
      return left.slice(0, -1).concat(right);
    }
    const result = [pts[start]];
    for (let i = start + 1; i <= end; i++) {
      if (fixed.has(i) || i === end) result.push(pts[i]);
    }
    return result;
  }

  return rdp(points, 0, points.length - 1, tolerance);
}

function finishCabo(){
  if(!pendingCable||caboPoints.length<2){cancelCabo();return;}
  cabocnt++;

  // Índices das âncoras no array caboPoints
  const anchorIndices = [];
  if(pendingCable.anchors && pendingCable.anchors.length) {
    pendingCable.anchors.forEach(anchorId => {
      const el = anchorables().find(a => a.id === anchorId);
      if(el) {
        for(let i = 0; i < caboPoints.length; i++) {
          const pt = caboPoints[i];
          if(Math.abs(pt[0] - el.lat) < 0.00001 && Math.abs(pt[1] - el.lng) < 0.00001) {
            anchorIndices.push(i);
            break;
          }
        }
      }
    });
  }

  // Simplifica pontos, mas preserva âncoras
  const simplified = simplifyPoints(caboPoints, anchorIndices, 2);
  const anchorMap = {};
  if(pendingCable.anchors && pendingCable.anchors.length) {
    simplified.forEach((pt, i) => {
      anchorables().forEach(a => {
        if(Math.abs(a.lat - pt[0]) < 0.00001 && Math.abs(a.lng - pt[1]) < 0.00001) {
          anchorMap[i] = a.id;
        }
      });
    });
  }

  const d = {
    id: pendingCable.id, tipo:'cabo', points: [...simplified],
    grupos: pendingCable.grupos, fpg: pendingCable.fpg, total: pendingCable.total,
    estilo: pendingCable.estilo, color: pendingCable.color,
    typeId: pendingCable.typeId, typeName: pendingCable.typeName,
    dist: calcDist(simplified), nome: pendingCable.id, obs: '',
    anchors: [...pendingCable.anchors], anchorMap,
    fibers: { connections:[], splitters:[], diagramPositions:{} }
  };

  if(caboPolyline) map.removeLayer(caboPolyline);
  const poly = L.polyline(simplified, { color: d.color, weight: 4, opacity: .9 }).addTo(map);
  d.poly = poly; cabos.push(d);
  poly.on('click', e => { L.DomEvent.stopPropagation(e); selectedElem = d; });
  poly.on('dblclick', e => { L.DomEvent.stopPropagation(e); openEmModal(d); });

  cleanupCabo();
  updStats(); debouncedUpdList(); updCableLegend(); scheduleAutosave();
  stateManager.pushState(`Criar Cabo ${d.id}`);
  setMode('select');
}

function cancelCabo(){cleanupCabo();if(mode==='cabo')setMode('select');}
function cleanupCabo(){
  highlightAnchorsForCabo(false);
  tempDots.forEach(d=>map.removeLayer(d));tempDots=[];
  if(caboPolyline){map.removeLayer(caboPolyline);caboPolyline=null;}
  caboPoints=[];drawingCabo=false;pendingCable=null;
  document.getElementById('cable-actions').classList.remove('show');
}
function calcDist(pts){
  let d=0;for(let i=1;i<pts.length;i++)d+=L.latLng(pts[i-1]).distanceTo(L.latLng(pts[i]));
  return Math.round(d);
}
function handleElemClick(d){selectedElem=d;hlElem(d);showElementPopup(d);}
function showElementPopup(d){
  if(!d||!d.marker)return;
  const lines=[`<strong style="color:var(--text);font-size:12px">${d.nome||d.id}</strong>`];
  if(d.tipo==='poste'){
    const children=d.children||[];
    if(children.length){
      const ordem={emenda:1,deriv:2,cto:3};
      [...children].sort((a,b)=>(ordem[a.tipo]||99)-(ordem[b.tipo]||99)).forEach(c=>{
        const el=findById(c.id);if(!el)return;
        const tag={cto:'CTO',emenda:'CEo',deriv:'Deriv'}[c.tipo]||c.tipo;
        lines.push(`<span style="color:var(--text3)">${tag}</span> <span style="color:var(--text2)">${el.nome||el.id}</span>`);
      });
    }else{
      lines.push(`<span style="color:var(--text3)">Sem sub-elementos</span>`);
    }
  }else if(d.tipo==='armario'){
    olts.filter(o=>o.parentId===d.id).forEach(o=>{
      lines.push(`<span style="color:var(--text3)">OLT</span> <span style="color:var(--text2)">${o.nome||o.id}</span>`);
    });
    lines.push(`<span style="color:var(--text3)">Cap: ${d.capacidade||24} portas</span>`);
  }
  d.marker.bindPopup(
    `<div style="font-size:11px;font-family:var(--mono);line-height:1.75;white-space:nowrap">${lines.join('<br>')}</div>`,
    {closeButton:false,className:'elem-popup',offset:[0,-18],autoPan:false}
  ).openPopup();
}
function hlElem(d){
  document.querySelectorAll('.ei').forEach(e=>e.classList.remove('sel'));
  const el=document.querySelector(`.ei[data-id="${d.id}"]`);
  if(el)el.classList.add('sel');
}
// ═══════ CABOS PRÓXIMOS / ATENUAÇÃO / LEGENDA ═══════
function cablesNear(d){
  return cabos.filter(c=>{
    // anchorMap with entries → use it (mais confiável)
    if(c.anchorMap&&Object.keys(c.anchorMap).length>0)
      return Object.values(c.anchorMap).includes(d.id);
    // anchors array fallback
    if(c.anchors&&c.anchors.includes(d.id)) return true;
    // Fallback: qualquer ponto do cabo dentro de 50m
    const pt=L.latLng(d.lat,d.lng);
    return (c.points||[]).some(p=>pt.distanceTo(L.latLng(p))<=50);
  });
}
function cableDir(d,c){
  if(!c.anchorMap) return 'saída';
  const idxs = Object.entries(c.anchorMap).filter(([,id])=>id===d.id).map(([i])=>parseInt(i));
  if(idxs.length===0) return 'saída';
  const idx = Math.min(...idxs);
  const lastIdx = c.points.length-1;
  if(idx===0) return 'saída';
  if(idx===lastIdx) return 'entrada';
  return 'passagem';
}
function cableLabel(d,c){
  const dir = cableDir(d,c);
  const nomeCabo = c.nome || c.id;
  if(dir==='saída') return `${nomeCabo} – saída`;
  if(dir==='entrada') return `${nomeCabo} – entrada`;
  return `${nomeCabo} – entrada/saída`;
}
function calcAtt(c){
  const dk=c.dist/1000;
  const af=dk*ATT.fibra;
  const ec=countNear(c.points,emendas,30);
  let splitterLoss=0;
  if(c.anchors&&c.anchors.length){
    c.anchors.forEach(aid=>{
      const el=findById(aid);
      if(el&&el.tipo==='cto'&&el.splitter)splitterLoss+=SPLITTER_LOSS[el.splitter]||0;
      if(el&&el.tipo==='deriv'&&el.splitter)splitterLoss+=SPLITTER_LOSS[el.splitter]||0;
    });
  }
  const tot=af+ec*ATT.emenda+ATT.conector*2+splitterLoss;
  return{af,ec,tot,splitterLoss,margin:ATT.budget-tot};
}
function countNear(pts,elems,r){
  let n=0;
  elems.forEach(el=>{
    const p=L.latLng(el.lat,el.lng);
    for(let i=1;i<pts.length;i++){
      const a=L.latLng(pts[i-1]),b=L.latLng(pts[i]);
      const dx=b.lng-a.lng,dy=b.lat-a.lat,d2=dx*dx+dy*dy;
      const t=d2?Math.max(0,Math.min(1,((p.lng-a.lng)*dx+(p.lat-a.lat)*dy)/d2)):0;
      if(p.distanceTo(L.latLng(a.lat+t*dy,a.lng+t*dx))<=r){n++;break;}
    }
  });
  return n;
}
function updCableLegend(){
  const el=document.getElementById('cable-legend');
  if(!cabos.length){el.innerHTML='';return;}
  el.innerHTML=cabos.map(c=>`
    <div class="li">
      <div class="ll" style="background:${c.color}"></div>
      <span style="font-size:11px;font-family:var(--mono)">${c.nome||c.id} <span style="color:var(--text3)">${c.total}FO</span></span>
    </div>`).join('');
}


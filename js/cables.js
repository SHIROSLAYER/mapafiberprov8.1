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
    const a=abntColor(i,fpg);
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
  if(mode==='medida'){ if(measurePaused)return; addMeasurePoint(lat,lng); return; }
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
  poly.on('click', e => { L.DomEvent.stopPropagation(e); selectedElem = d; showCablePopup(d, e.latlng); });
  bindDblTap(poly, e => openCableAtClick(d, e));

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
function showCablePopup(d,latlng){
  if(!d||!d.poly)return;
  const att=calcAtt(d);
  const distFmt=d.dist>=1000?(d.dist/1000).toFixed(3)+' km':d.dist+' m';
  const anchorIds=Object.values(d.anchorMap||{});
  const anchorNames=anchorIds.slice(0,3).map(id=>{const el=findById(id);return el?(el.nome||el.id):id;}).join(' → ');
  const lines=[
    `<strong style="color:var(--text);font-size:12px">Cabo ${d.nome||d.id}</strong>`,
    `<span style="color:var(--text3)">${d.typeName||'—'}</span> <span style="color:var(--text2)">${d.grupos||1}T × ${d.fpg||12}FO</span>`,
    `<span style="color:var(--text3)">Distância:</span> <span style="color:var(--green)">${distFmt}</span>`,
    `<span style="color:var(--text3)">Atenuação:</span> <span style="color:${att.margin>=0?'var(--green)':'var(--red)'}">${att.tot.toFixed(2)} dB</span>`
  ];
  if(anchorNames) lines.push(`<span style="color:var(--text3)">Ancoragens:</span> <span style="color:var(--text2)">${anchorNames}${anchorIds.length>3?' …':''}</span>`);
  L.popup({closeButton:false,className:'elem-popup',autoPan:false,offset:[0,-4]})
    .setLatLng(latlng||d.poly.getLatLngs()[Math.floor(d.poly.getLatLngs().length/2)])
    .setContent(`<div style="font-size:11px;font-family:var(--mono);line-height:1.75;white-space:nowrap">${lines.join('<br>')}</div>`)
    .openOn(map);
}

// Cor associada a cada tipo (badge no balão)
const ELEM_COLOR={poste:'#3B82F6',armario:'#EC4899',cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',olt:'#06B6D4',cabo:'#1D9E75'};

function elemBadge(tipo,nome){
  const c=ELEM_COLOR[tipo]||'#888';
  const label={cto:'CTO',emenda:'CEO',deriv:'Deriv',olt:'OLT',poste:'Poste',armario:'Armário'}[tipo]||tipo;
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:6px;background:${c}22;border-left:3px solid ${c};color:var(--text);font-size:11px;line-height:1.4;margin:2px 0"><span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;box-shadow:0 0 0 1px rgba(255,255,255,.5)"></span><span style="color:${c};font-weight:700;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.4px">${label}</span> <span style="color:var(--text);font-weight:600">${nome}</span></span>`;
}

function showElementPopup(d){
  if(!d||!d.marker)return;
  // Usa o mesmo HTML que o tooltip de hover — visual unificado
  const html=buildElemTooltipHTML(d);
  // L.popup direto, sempre abre (não toggle como bindPopup)
  L.popup({closeButton:false,className:'elem-popup',offset:[0,-22],autoPan:true,autoClose:true,closeOnClick:true,maxWidth:300})
    .setLatLng(d.marker.getLatLng())
    .setContent(html)
    .openOn(map);
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
// ═══════ ANIMAÇÃO DO CAMINHO DO CABO ═══════
let _pathAnimLayers=[];
function clearPathAnim(){
  _pathAnimLayers.forEach(l=>{try{map.removeLayer(l);}catch(e){}});
  if(_pathAnimLayers._raf)cancelAnimationFrame(_pathAnimLayers._raf);
  _pathAnimLayers=[];
}
function closeCablePath(){
  clearPathAnim();
  var pa=document.getElementById('path-actions');
  if(pa)pa.classList.remove('show');
}

// ═══════ EDIÇÃO DE ANCORAGEM ═══════
let _editAnchor={cable:null,handles:[],origStyle:null};
function editCableAnchoring(d){
  if(!d||!d.points||d.points.length<1){showToast('Cabo inválido','warning');return;}
  closeEmModal();
  closeCableAnchoringEdit(); // limpa qualquer edição anterior
  _editAnchor.cable=d;
  _editAnchor.handles=[];
  // Realça o cabo
  _editAnchor.origStyle={color:d.poly.options.color,weight:d.poly.options.weight,opacity:d.poly.options.opacity,dashArray:d.poly.options.dashArray,className:d.poly.options.className};
  d.poly.setStyle({color:'#F59E0B',weight:6,opacity:.95,dashArray:'14,8'});
  if(d.poly._path)d.poly._path.classList.add('cable-editing');
  // Foca o cabo
  if(d.points.length>=2) map.fitBounds(L.latLngBounds(d.points),{padding:[60,60],maxZoom:18,animate:true,duration:0.5});
  // Cria handles em cada âncora (e nas extremidades, mesmo que não estejam ancoradas)
  const anchorIdxs=new Set(Object.keys(d.anchorMap||{}).map(k=>parseInt(k)));
  anchorIdxs.add(0);
  anchorIdxs.add(d.points.length-1);
  Array.from(anchorIdxs).sort((a,b)=>a-b).forEach(idx=>{
    if(idx<0||idx>=d.points.length)return;
    const anchoredId=(d.anchorMap||{})[idx];
    const anchoredEl=anchoredId?findById(anchoredId):null;
    const label=idx===0?'A':idx===d.points.length-1?'B':String(idx+1);
    const handle=L.marker(d.points[idx],{
      icon:L.divIcon({className:'anchor-handle',html:'<div class="anchor-handle-inner">'+label+'</div>',iconSize:[28,28],iconAnchor:[14,14]}),
      draggable:true,zIndexOffset:2000
    }).addTo(map);
    handle._idx=idx;
    handle._origLatLng=L.latLng(d.points[idx][0],d.points[idx][1]);
    handle._origAnchorId=anchoredId||null;
    // Snap visual ao arrastar
    handle.on('drag',function(){
      const ll=handle.getLatLng();
      const near=findNearestAnchorable(ll,30);
      handle._snapTo=near;
      const el=handle.getElement();
      if(el){el.classList.toggle('anchor-snap',!!near);}
    });
    handle.on('dragend',function(){
      const target=handle._snapTo;
      if(!target){
        // soltou no vazio: volta pra posição anterior
        handle.setLatLng(handle._origLatLng);
        return;
      }
      // Mostra confirmação
      const tipoLbl=({poste:'Poste',armario:'Armário'}[target.tipo]||target.tipo);
      const nome=target.nome||target.id;
      const ptLabel=idx===0?'início (A)':idx===d.points.length-1?'fim (B)':'ponto '+(idx+1);
      showConf(
        'Confirmar ancoragem',
        `<div style="font-size:13px;line-height:1.7">Re-ancorar o <b>${ptLabel}</b> do cabo <b>${d.nome||d.id}</b> em:<br>` +
        `<b style="color:var(--green);font-size:14px">${tipoLbl} ${nome}</b></div>`,
        function(){
          // CONFIRMA: atualiza anchorMap, points e polyline
          applyAnchorChange(d,idx,target);
          handle.setLatLng([target.lat,target.lng]);
          handle._origLatLng=L.latLng(target.lat,target.lng);
          handle._origAnchorId=target.id;
          const el=handle.getElement();if(el)el.classList.remove('anchor-snap');
          showToast(`✓ Ancorado em ${tipoLbl} ${nome}`,'success');
        },
        function(){
          // CANCELA: reverte
          handle.setLatLng(handle._origLatLng);
          const el=handle.getElement();if(el)el.classList.remove('anchor-snap');
        },
        'gn'
      );
    });
    _editAnchor.handles.push(handle);
  });
  const pa=document.getElementById('anchor-edit-actions');
  if(pa)pa.classList.add('show');
  showToast('⚓ Arraste as âncoras laranjas para outros postes/armários','info');
}

function findNearestAnchorable(latlng,tolMeters){
  const list=anchorables();
  let best=null,bestD=Infinity;
  list.forEach(a=>{
    const d=L.latLng(a.lat,a.lng).distanceTo(latlng);
    if(d<bestD&&d<=tolMeters){bestD=d;best=a;}
  });
  return best;
}

function applyAnchorChange(d,idx,target){
  // Atualiza o ponto na polyline e o anchorMap
  d.points[idx]=[target.lat,target.lng];
  if(!d.anchorMap)d.anchorMap={};
  d.anchorMap[idx]=target.id;
  // Atualiza array de anchors (lista única de IDs)
  d.anchors=Object.values(d.anchorMap).filter((v,i,a)=>a.indexOf(v)===i);
  d.poly.setLatLngs(d.points);
  d.dist=calcDist(d.points);
  updCableLegend&&updCableLegend();
  updStats&&updStats();
  scheduleAutosave&&scheduleAutosave();
  stateManager.pushState('Re-ancorar '+(d.nome||d.id));
}

// ═══════ ESCOLHA DE CABO QUANDO HÁ SOBREPOSIÇÃO ═══════
function distToSegMeters(p,a,b){
  var ap=map.distance(a,p),ab=map.distance(a,b),bp=map.distance(b,p);
  if(ab===0)return ap;
  var cosA=(ap*ap+ab*ab-bp*bp)/(2*ap*ab);
  if(cosA<=0)return ap;
  var proj=ap*cosA;
  if(proj>=ab)return bp;
  var h2=ap*ap-proj*proj;
  return h2>0?Math.sqrt(h2):0;
}
function findCablesNearPoint(latlng,tolMeters){
  var result=[];
  cabos.forEach(function(c){
    var pts=c.points||[];
    for(var i=1;i<pts.length;i++){
      var a=L.latLng(pts[i-1]),b=L.latLng(pts[i]);
      if(distToSegMeters(latlng,a,b)<=tolMeters){result.push(c);break;}
    }
  });
  return result;
}
function openCableAtClick(cab,e){
  var ll=e&&e.latlng?e.latlng:(cab.points&&cab.points[0]?L.latLng(cab.points[0]):null);
  if(!ll){openEmModal(cab);return;}
  var nearby=findCablesNearPoint(ll,15);
  if(nearby.length<=1){openEmModal(cab);return;}
  showCableChooser(nearby,ll);
}
function showCableChooser(list,latlng){
  var ov=document.getElementById('cable-chooser-overlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='cable-chooser-overlay';
    ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9700;align-items:center;justify-content:center;padding:16px';
    ov.addEventListener('click',function(e){if(e.target===ov)closeCableChooser();});
    document.body.appendChild(ov);
  }
  var rows='';
  list.forEach(function(c){
    var distFmt=c.dist>=1000?(c.dist/1000).toFixed(3)+' km':c.dist+' m';
    var anchors=Object.values(c.anchorMap||{}).slice(0,2).map(function(id){var el=findById(id);return el?(el.nome||el.id):id;}).join(' → ')||'sem âncoras';
    rows+='<div class="cc-row" onclick="pickCable(\''+c.id+'\')">'+
      '<span class="cc-swatch" style="background:'+c.color+'"></span>'+
      '<div class="cc-info"><b>'+(c.nome||c.id)+'</b>'+
      '<span class="cc-meta">'+(c.typeName||c.typeId||'—')+' · '+(c.total||'?')+'FO · '+distFmt+'</span>'+
      '<span class="cc-anchors">'+anchors+'</span></div>'+
      '<span class="cc-go">→</span></div>';
  });
  ov.innerHTML='<div class="cc-modal">'+
    '<div class="cc-hdr"><div><h3>Selecione o cabo</h3><p>'+list.length+' cabos passam por este ponto. Toque no que deseja abrir:</p></div><button class="cc-close" onclick="closeCableChooser()">✕</button></div>'+
    '<div class="cc-list">'+rows+'</div>'+
    '<div class="cc-footer"><button class="pab" onclick="closeCableChooser()">Cancelar</button></div>'+
    '</div>';
  ov.style.display='flex';
}
function pickCable(id){
  var c=findById(id);
  closeCableChooser();
  if(c)openEmModal(c);
}
function closeCableChooser(){
  var ov=document.getElementById('cable-chooser-overlay');
  if(ov)ov.style.display='none';
}

// ═══════ TRAÇADO GLOBAL DE FIBRA (entre postes/armários) ═══════
function decodeGlobalEndpoint(eid,fi){
  if(eid.indexOf('cable:')===0){
    var key=eid.slice(6);
    var rawId=key.replace('::I','').replace('::O','');
    var side=key.indexOf('::I')>=0?' (entrada)':key.indexOf('::O')>=0?' (saída)':'';
    var cab=cabos.find(function(c){return c.id===rawId;});
    if(!cab)return {tipo:'Cabo',nome:rawId+side,detail:'fi '+fi,color:'#888'};
    var fpg=cab.fpg||12,grupos=cab.grupos||1;
    var g=Math.floor(fi/fpg)+1,f=(fi%fpg)+1;
    var detail=grupos>1?('Tubo '+g+' · Fibra '+f):('Fibra '+f);
    var color=ABNT[(f-1)%12].hex;
    return {tipo:'Cabo',nome:(cab.nome||cab.id)+side,detail:detail,color:color,ref:cab};
  }
  if(eid.indexOf('in:')===0||eid.indexOf('out:')===0){
    var sid=eid.replace(/^(in|out):/,'');
    var el=findById(sid);
    var tipos={cto:'CTO',emenda:'Emenda',deriv:'Derivação',olt:'OLT'};
    var t=el?(tipos[el.tipo]||el.tipo):'Elemento';
    var nome=el?(el.nome||el.id):sid;
    var isOLT=el&&el.tipo==='olt';
    var portWord=isOLT?'PON':'Porta';
    var detail=eid.indexOf('in:')===0?'Entrada':portWord+' '+(fi+1);
    var colors={cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',olt:'#06B6D4'};
    var color=el?(colors[el.tipo]||'#888'):'#888';
    return {tipo:t,nome:nome,detail:detail,color:color,ref:el};
  }
  return {tipo:'?',nome:eid,detail:'fi '+fi,color:'#888'};
}

function allFiberConnections(){
  // Junta todas as conexões de fibra de todos postes/armários num único array
  var all=[];
  [].concat(postes||[],armarios||[]).forEach(function(d){
    var conns=(d.fibers&&d.fibers.connections)||[];
    conns.forEach(function(c){if(c&&c.fromId)all.push({owner:d.id,c:c});});
  });
  return all;
}

function traceFiberGlobal(startEid,startFi){
  // BFS — retorna lista ordenada de hops [{eid,fi,viaCable?}, ...]
  // explora AMBAS as direções da fibra (do cabo: vai pro OLT E pro cliente)
  var hops=[{eid:startEid,fi:startFi}];
  var visited={};visited[startEid+':'+startFi]=true;
  var all=allFiberConnections();
  var queue=[{eid:startEid,fi:startFi}];
  var safety=0;
  while(queue.length&&safety++<200){
    var cur=queue.shift();
    // Atravessa passagem do mesmo cabo (::I ↔ ::O) — mesma fibra física
    var pairEid=null;
    if(cur.eid.indexOf('::I')>=0)pairEid=cur.eid.replace('::I','::O');
    else if(cur.eid.indexOf('::O')>=0)pairEid=cur.eid.replace('::O','::I');
    if(pairEid){
      var pk=pairEid+':'+cur.fi;
      if(!visited[pk]){
        visited[pk]=true;
        hops.push({eid:pairEid,fi:cur.fi,viaCable:true});
        queue.push({eid:pairEid,fi:cur.fi});
      }
    }
    // Acha TODAS conexões envolvendo cur.eid/cur.fi e expande para os peers
    var candidates=[cur.eid];
    if(cur.eid.indexOf('cable:')===0&&cur.eid.indexOf('::')<0){
      candidates.push(cur.eid+'::I',cur.eid+'::O');
    }
    for(var i=0;i<all.length;i++){
      var c=all[i].c;
      for(var k=0;k<candidates.length;k++){
        var eidT=candidates[k];
        var peer=null;
        if(c.fromId===eidT&&c.fromFi===cur.fi)peer={eid:c.toId,fi:c.toFi};
        else if(c.toId===eidT&&c.toFi===cur.fi)peer={eid:c.fromId,fi:c.fromFi};
        if(peer){
          var pkey=peer.eid+':'+peer.fi;
          if(!visited[pkey]){
            visited[pkey]=true;
            hops.push(peer);
            queue.push(peer);
          }
        }
      }
    }
  }
  return hops;
}

function findOLTForFiber(cabId,fi){
  // Traça e procura uma OLT no caminho. Retorna {nome, pon} ou null
  var hops=traceFiberGlobal('cable:'+cabId,fi);
  var found=null;
  for(var i=0;i<hops.length;i++){
    var h=hops[i];
    if(h.eid.indexOf('out:')===0){
      var sid=h.eid.slice(4);
      var el=findById(sid);
      if(el&&el.tipo==='olt'){found={nome:el.nome||el.id,pon:h.fi+1};break;}
    }
  }
  if(found)return found;
  // Tenta o lado ::I e ::O também
  var suffixes=['::I','::O'];
  for(var k=0;k<suffixes.length;k++){
    var suf=suffixes[k];
    if(cabId.indexOf(suf)<0){
      var alt=traceFiberGlobal('cable:'+cabId+suf,fi);
      for(var j=0;j<alt.length;j++){
        var hh=alt[j];
        if(hh.eid.indexOf('out:')===0){
          var ssid=hh.eid.slice(4);
          var ee=findById(ssid);
          if(ee&&ee.tipo==='olt')return {nome:ee.nome||ee.id,pon:hh.fi+1};
        }
      }
    }
  }
  return null;
}

function showCableFiberPathModal(cabId,fi){
  var hops=traceFiberGlobal('cable:'+cabId,fi);
  if(hops.length<=1){
    // Tenta também os lados ::I/::O
    var altI=traceFiberGlobal('cable:'+cabId+'::I',fi);
    var altO=traceFiberGlobal('cable:'+cabId+'::O',fi);
    if(altI.length>hops.length)hops=altI;
    if(altO.length>hops.length)hops=altO;
  }
  // Monta HTML
  var html='<div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px"><span style="font-size:20px">🔍</span><div><h3 style="margin:0;font-size:15px">Caminho da Fibra</h3><div style="font-size:11px;color:var(--text3);font-family:var(--mono)">'+hops.length+' elemento(s) · '+(hops.length-1)+' hop(s)</div></div><button onclick="closeFiberPathModal()" style="margin-left:auto;width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer">✕</button></div>';
  html+='<div style="padding:14px 18px;max-height:60vh;overflow-y:auto">';
  if(hops.length===0){
    html+='<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Esta fibra ainda não tem conexões.</div>';
  }else{
    hops.forEach(function(h,i){
      var d=decodeGlobalEndpoint(h.eid,h.fi);
      var prev=i>0?hops[i-1]:null;
      var via=h.viaCable?'⤓ passa pelo cabo':(prev?'↔ conectado a':'');
      if(i>0)html+='<div style="padding:4px 0 4px 16px;font-size:10px;color:var(--text3);font-family:var(--mono)">'+via+'</div>';
      html+='<div style="display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--bg3);border-radius:8px;border-left:4px solid '+d.color+';margin-bottom:6px">';
      html+='<div style="width:26px;height:26px;border-radius:50%;background:var(--green);color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--mono)">'+(i+1)+'</div>';
      html+='<div style="flex:1;font-size:12px"><b style="color:var(--text)">'+d.tipo+' '+escH(d.nome)+'</b><br><span style="color:var(--text2);font-family:var(--mono);font-size:11px">'+d.detail+'</span></div>';
      html+='</div>';
    });
  }
  html+='</div>';
  // overlay
  var ov=document.getElementById('fiber-path-overlay');
  if(!ov){
    ov=document.createElement('div');ov.id='fiber-path-overlay';
    ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9800;align-items:center;justify-content:center;padding:16px';
    ov.addEventListener('click',function(e){if(e.target===ov)closeFiberPathModal();});
    document.body.appendChild(ov);
  }
  ov.innerHTML='<div style="background:var(--bg2);border:1px solid var(--green);border-radius:var(--rxl);width:min(520px,96vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.7)">'+html+'</div>';
  ov.style.display='flex';
}
function closeFiberPathModal(){
  var ov=document.getElementById('fiber-path-overlay');
  if(ov)ov.style.display='none';
}

function closeCableAnchoringEdit(){
  if(!_editAnchor.cable){
    const pa0=document.getElementById('anchor-edit-actions');
    if(pa0)pa0.classList.remove('show');
    return;
  }
  // Restaura estilo do cabo
  const d=_editAnchor.cable;
  if(d.poly){
    d.poly.setStyle(_editAnchor.origStyle||{color:d.color||'#1D9E75',weight:4,opacity:.9,dashArray:null});
    if(d.poly._path)d.poly._path.classList.remove('cable-editing');
  }
  _editAnchor.handles.forEach(h=>{try{map.removeLayer(h);}catch(e){}});
  _editAnchor.handles=[];
  _editAnchor.cable=null;
  _editAnchor.origStyle=null;
  const pa=document.getElementById('anchor-edit-actions');
  if(pa)pa.classList.remove('show');
}
function showCablePath(d){
  if(!d||!d.points||d.points.length<2){showToast('Cabo sem trajeto definido','warning');return;}
  closeEmModal();
  clearPathAnim();
  const pts=d.points;
  const totalLen=d.dist||calcDist(pts);
  // Foca o mapa no cabo
  map.fitBounds(L.latLngBounds(pts),{padding:[60,60],maxZoom:18,animate:true,duration:0.7});
  // Linha de fundo (rastro estático em destaque)
  const bgLine=L.polyline(pts,{color:'#1a2332',weight:9,opacity:.55,lineCap:'round',lineJoin:'round'}).addTo(map);
  // Linha principal animada (marching ants amarelas)
  const fgLine=L.polyline(pts,{color:'#F59E0B',weight:5,opacity:.95,lineCap:'round',lineJoin:'round',dashArray:'12,10',className:'cable-path-march'}).addTo(map);
  // Marcador de INÍCIO
  const startMk=L.marker(pts[0],{icon:L.divIcon({className:'path-end-mk',html:'<div class="path-end-badge start">A</div>',iconSize:[28,28],iconAnchor:[14,14]}),interactive:false}).addTo(map);
  // Marcador de FIM
  const endMk=L.marker(pts[pts.length-1],{icon:L.divIcon({className:'path-end-mk',html:'<div class="path-end-badge end">B</div>',iconSize:[28,28],iconAnchor:[14,14]}),interactive:false}).addTo(map);
  // Setas de direção a cada ~20% do caminho
  const arrowMarkers=[];
  for(let frac=0.2;frac<1;frac+=0.2){
    const pt=interpolateAlong(pts,frac);
    if(!pt)continue;
    const nxt=interpolateAlong(pts,Math.min(frac+0.01,1));
    const bearing=nxt?bearingDeg(pt,nxt):0;
    const ar=L.marker(pt,{icon:L.divIcon({className:'path-arrow-mk',html:`<div class="path-arrow" style="transform:rotate(${bearing}deg)">➤</div>`,iconSize:[24,24],iconAnchor:[12,12]}),interactive:false}).addTo(map);
    arrowMarkers.push(ar);
  }
  // "Pulso" que percorre do A → B
  const pulse=L.circleMarker(pts[0],{radius:9,color:'#fff',fillColor:'#F59E0B',fillOpacity:1,weight:3,interactive:false}).addTo(map);
  let t0=performance.now(),dur=4000,raf=null;
  function step(now){
    const frac=Math.min(1,(now-t0)/dur);
    const p=interpolateAlong(pts,frac);
    if(p)pulse.setLatLng(p);
    if(frac<1){raf=requestAnimationFrame(step);}
    else{
      // ao chegar em B, repete
      t0=performance.now();
      raf=requestAnimationFrame(step);
    }
  }
  raf=requestAnimationFrame(step);
  _pathAnimLayers.push(bgLine,fgLine,startMk,endMk,pulse,...arrowMarkers);
  _pathAnimLayers._raf=raf;
  const distFmt=totalLen>=1000?(totalLen/1000).toFixed(3)+' km':Math.round(totalLen)+' m';
  showToast(`▶ Caminho de ${d.nome||d.id} — ${distFmt} de A → B`,'info');
  // Mostra painel inferior com botão de sair
  var pa=document.getElementById('path-actions');
  if(pa)pa.classList.add('show');
}
function interpolateAlong(pts,frac){
  // Acha o ponto a `frac` (0..1) do comprimento total da polilinha
  let total=0;const segs=[];
  for(let i=1;i<pts.length;i++){
    const d=L.latLng(pts[i-1]).distanceTo(L.latLng(pts[i]));
    segs.push(d);total+=d;
  }
  if(total===0)return pts[0];
  let target=frac*total,acc=0;
  for(let i=0;i<segs.length;i++){
    if(acc+segs[i]>=target){
      const r=(target-acc)/segs[i];
      return [pts[i][0]+(pts[i+1][0]-pts[i][0])*r,pts[i][1]+(pts[i+1][1]-pts[i][1])*r];
    }
    acc+=segs[i];
  }
  return pts[pts.length-1];
}
function bearingDeg(a,b){
  const φ1=a[0]*Math.PI/180,φ2=b[0]*Math.PI/180,Δλ=(b[1]-a[1])*Math.PI/180;
  const y=Math.sin(Δλ)*Math.cos(φ2);
  const x=Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
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
  // Legenda removida do painel — função mantida como no-op para compatibilidade
  const el=document.getElementById('cable-legend');
  if(el)el.innerHTML='';
}


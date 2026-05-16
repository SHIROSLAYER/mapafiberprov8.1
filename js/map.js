// ═══════════════════════════════════════════════
// map.js — Mapa, Tiles, Ícones, setMode, Auxiliares
// ═══════════════════════════════════════════════

// ═══════ GRUPOS DE CLUSTER ═══════
let clusterPostes, clusterArmarios;

// ═══════ DEBOUNCE PARA UPDLIST ═══════
let updateListTimeout;
function debouncedUpdList() {
  clearTimeout(updateListTimeout);
  updateListTimeout = setTimeout(updList, 200);
}

// ═══════ FUNÇÕES AUXILIARES ═══════
// Detector universal de duplo-toque para Leaflet — funciona em iOS, Android e desktop
function bindDblTap(layer, opener){
  var lastT=0,fired=false;
  function doFire(e){
    if(fired)return;
    fired=true;
    L.DomEvent.stopPropagation(e);
    if(map&&map.closePopup)map.closePopup();
    opener(e);
    setTimeout(function(){fired=false;lastT=0;},600);
  }
  layer.on('click',function(e){
    var now=Date.now();
    if(now-lastT<450){doFire(e);}
    else{lastT=now;}
  });
  // dblclick nativo (rápido em desktop) — também dispara, mas fired previne duplicado
  layer.on('dblclick',function(e){L.DomEvent.preventDefault(e);doFire(e);});
}

function toggleTray(id){
  const allTrays=['tray-tools','tray-search','tray-info'];
  const allBtns={
    'tray-tools':'toggle-tools',
    'tray-search':'toggle-search',
    'tray-info':'toggle-info'
  };
  const target=document.getElementById(id);
  const willOpen=!target.classList.contains('show');

  allTrays.forEach(t=>{
    document.getElementById(t).classList.remove('show');
    const btnId=allBtns[t];
    if(btnId){const b=document.getElementById(btnId);if(b)b.classList.remove('active');}
  });
  // Tira foco do input de busca ao fechar bandeja (libera atalhos de teclado)
  const si=document.getElementById('search-input');
  if(si&&document.activeElement===si)si.blur();

  if(willOpen){
    target.classList.add('show');
    const btnId=allBtns[id];
    if(btnId){const b=document.getElementById(btnId);if(b)b.classList.add('active');}
    if(id==='tray-search'){
      setTimeout(()=>{
        const inp=document.getElementById('search-input');
        if(inp)inp.focus();
      },60);
    }
  }

  setTimeout(()=>{if(map)map.invalidateSize();},300);
}
function showToast(msg, type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast show '+type;
  setTimeout(()=>t.classList.remove('show'),2500);
}
function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }

// ═══════ ÍCONES ═══════
const _CHILD_CFG = {
  cto:   { label:'C', color:'#F59E0B' },
  emenda:{ label:'E', color:'#EF4444' },
  deriv: { label:'D', color:'#8B5CF6' }
};

// Conta elementos (postes OU armários) dentro de tolM metros — para badge ×N
// em projetos KML que importam múltiplos pontos sobrepostos. Funciona pra
// ambos tipos: cada um conta apenas seus pares dentro do MESMO array.
function _getOverlapCountIn(p, tolM, pool){
  if(!p||p.lat==null)return 1;
  if(typeof p._overlapCache==='number'&&p._overlapCacheTol===tolM)return p._overlapCache;
  let count=1;
  const here=L.latLng(p.lat,p.lng);
  (pool||[]).forEach(o=>{
    if(o===p||o.lat==null)return;
    const d=here.distanceTo(L.latLng(o.lat,o.lng));
    if(d<=tolM)count++;
  });
  p._overlapCache=count;p._overlapCacheTol=tolM;
  return count;
}
function getPosteOverlapCount(p, tolM){return _getOverlapCountIn(p,tolM,postes);}
function getArmarioOverlapCount(a, tolM){return _getOverlapCountIn(a,tolM,armarios);}
function clearOverlapCache(){
  (postes||[]).forEach(p=>{delete p._overlapCache;delete p._overlapCacheTol;});
  (armarios||[]).forEach(a=>{delete a._overlapCache;delete a._overlapCacheTol;});
}
function refreshAllPosteIcons(){
  clearOverlapCache();
  (postes||[]).forEach(p=>{if(p.marker)p.marker.setIcon(buildPosteIcon(p));});
  // armarios usam o ícone genérico (sem badge dinâmico atualmente); apenas o
  // cache é invalidado para que futuras chamadas a getArmarioOverlapCount
  // (ex: tooltip) recalculem corretamente após mover/criar elementos.
}

function buildPosteIcon(p){
  const children = (p && p.children) || [];
  let badgesHtml = '';
  // Badge ×N quando há postes praticamente no mesmo ponto (ex: 2m de tolerância)
  const dupCount = getPosteOverlapCount(p, 2);
  let dupBadge = '';
  if(dupCount>1){
    dupBadge = `<div title="${dupCount} postes neste ponto" style="position:absolute;top:-8px;right:-10px;min-width:20px;height:20px;border-radius:10px;background:#EF4444;color:#fff;font-size:11px;font-weight:800;font-family:monospace;display:flex;align-items:center;justify-content:center;padding:0 5px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5);z-index:10;line-height:1">×${dupCount}</div>`;
  }
  if(children.length){
    const counts = {};
    children.forEach(c=>{ if(_CHILD_CFG[c.tipo]) counts[c.tipo]=(counts[c.tipo]||0)+1; });
    const badges = ['emenda','deriv','cto'].filter(t=>counts[t]).map(t=>{
      const {label,color}=_CHILD_CFG[t];
      const n=counts[t];
      const txt=n>1?label+n:label;
      return `<div style="min-width:15px;height:15px;border-radius:3px;background:${color};color:#000;font-size:8px;font-weight:800;font-family:monospace;display:flex;align-items:center;justify-content:center;padding:0 2px;border:1px solid rgba(0,0,0,.45);flex-shrink:0;line-height:1">${txt}</div>`;
    }).join('');
    if(badges) badgesHtml=`<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);display:flex;gap:2px;align-items:center">${badges}</div>`;
  }
  return L.divIcon({
    className: 'poste-icon',
    html: `<div style="position:relative;width:32px;height:32px;filter:drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff) drop-shadow(0 1px 2px rgba(0,0,0,.5));overflow:visible">${badgesHtml}${dupBadge}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" shape-rendering="geometricPrecision"><path fill="#000000" stroke="#000000" stroke-width="1.5" stroke-linejoin="round" d="m7 2l3 7h4l3-7zm6 18h3v2H8v-2h3V10h2z"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -32]
  });
}

const armarioIcon = L.divIcon({
  className: 'armario-icon',
  html: `<div style="filter:drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff) drop-shadow(0 1px 2px rgba(0,0,0,.5))"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="32" height="32" shape-rendering="geometricPrecision"><g fill="none" stroke="#000000" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"><path d="M42 4H6v10h36zm0 15H6v10h36zm0 15H6v10h36z"/><path d="M21 9h6m-6 15h6m-6 15h6"/></g></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

function refreshPosteIcon(p){ if(p&&p.marker) p.marker.setIcon(buildPosteIcon(p)); }
function refreshArmarioIcon(a){ if(a&&a.marker) a.marker.setIcon(armarioIcon); }

function bindPosteTooltip(poste){
  if(!poste.marker)return;
  poste.marker.unbindTooltip();
  poste.marker.bindTooltip(()=>buildElemTooltipHTML(poste),{direction:'top',offset:[0,-24],className:'elem-tooltip'});
}
function bindArmarioTooltip(arm){
  if(!arm.marker)return;
  arm.marker.unbindTooltip();
  arm.marker.bindTooltip(()=>buildElemTooltipHTML(arm),{direction:'top',offset:[0,-24],className:'elem-tooltip'});
}
function buildElemTooltipHTML(d){
  // Mesma estrutura visual do popup de click — apenas mais compacta
  const TIPO_LBL={poste:'Poste',armario:'Armário'};
  const COLOR={poste:'#3B82F6',armario:'#EC4899',cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',olt:'#06B6D4'};
  const LBL={cto:'CTO',emenda:'CEO',deriv:'Deriv',olt:'OLT'};
  const accent=COLOR[d.tipo]||'#888';
  const tipoLbl=TIPO_LBL[d.tipo]||d.tipo.toUpperCase();
  let body=`<div class="et-hdr" style="background:linear-gradient(135deg,${accent}33,transparent);border-left:4px solid ${accent}"><div class="et-tag" style="color:${accent}">${tipoLbl}</div><div class="et-name">${d.nome||d.id}</div></div>`;
  let items='';
  if(d.tipo==='poste'){
    const kids=(d.children||[]).map(c=>findById(c.id)).filter(Boolean);
    const ordem={emenda:1,deriv:2,cto:3,olt:4};
    [...kids].sort((a,b)=>(ordem[a.tipo]||99)-(ordem[b.tipo]||99)).forEach(el=>{
      const c=COLOR[el.tipo]||'#888';
      items+=`<div class="et-row" style="border-left-color:${c}"><span class="et-dot" style="background:${c}"></span><span class="et-lbl" style="color:${c}">${LBL[el.tipo]||el.tipo}</span><span class="et-vl">${el.nome||el.id}</span></div>`;
    });
    if(!kids.length)items=`<div class="et-empty">Sem sub-elementos</div>`;
  }else if(d.tipo==='armario'){
    const childOlts=olts.filter(o=>o.parentId===d.id);
    childOlts.forEach(o=>{
      const u=(typeof getOltUsage==='function')?getOltUsage(o.id,o.portas||16):{used:0,total:o.portas||16,pct:0};
      const col=(typeof oltUsageColor==='function')?oltUsageColor(u.pct):'#10B981';
      const pctTxt=Math.round(u.pct*100);
      items+=`<div class="et-row" style="border-left-color:#06B6D4"><span class="et-dot" style="background:#06B6D4"></span><span class="et-lbl" style="color:#06B6D4">OLT</span><span class="et-vl">${o.nome||o.id}</span><span class="et-mt" style="color:${col};font-weight:700">${u.used}/${u.total} PON · ${pctTxt}%</span></div>`;
    });
    if(!childOlts.length)items=`<div class="et-empty">Sem OLTs</div>`;
    items+=`<div class="et-meta">Cap: ${d.capacidade||24} portas</div>`;
  }
  return `<div class="elem-tip-wrap">${body}<div class="et-body">${items}</div></div>`;
}

// ═══════ MAPA ═══════

// Catálogo de tile layers
const TILE_LAYERS = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    desc: 'Padrão · atualizado',
    emoji: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    opts: { attribution: '© OpenStreetMap', maxZoom: 19, subdomains: 'abc' },
    // thumbnail: tile z10, próximo a Barra do Garças
    thumb: 'https://tile.openstreetmap.org/10/376/564.png',
  },
  {
    id: 'esri-sat',
    name: 'Satélite',
    desc: 'Esri World Imagery',
    emoji: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: { attribution: '© Esri', maxZoom: 19 },
    thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/564/376',
  },
  {
    id: 'esri-hybrid',
    name: 'Híbrido',
    desc: 'Satélite + ruas',
    emoji: '🏙️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: { attribution: '© Esri', maxZoom: 19 },
    thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/564/376',
    overlay: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-hybrid/{z}/{x}/{y}.png',
    overlayOpts: { opacity: 0.4, subdomains: 'abcd', maxZoom: 19 },
  },
  {
    id: 'carto-dark',
    name: 'CartoDB Dark',
    desc: 'Escuro · ideal à noite',
    emoji: '🌙',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: { attribution: '© CartoDB', maxZoom: 19, subdomains: 'abcd' },
    thumb: 'https://a.basemaps.cartocdn.com/dark_all/10/376/564.png',
  },
  {
    id: 'carto-light',
    name: 'CartoDB Light',
    desc: 'Claro · leitura fácil',
    emoji: '☀️',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    opts: { attribution: '© CartoDB', maxZoom: 19, subdomains: 'abcd' },
    thumb: 'https://a.basemaps.cartocdn.com/light_all/10/376/564.png',
  },
];

let _hybridOverlay = null;

function setTileLayer(id) {
  const def = TILE_LAYERS.find(t => t.id === id);
  if (!def) return;
  currentTileId = id;

  // Remove camada anterior
  if (activeTileLayer) { map.removeLayer(activeTileLayer); activeTileLayer = null; }
  if (_hybridOverlay)  { map.removeLayer(_hybridOverlay);  _hybridOverlay = null; }

  activeTileLayer = L.tileLayer(def.url, def.opts).addTo(map);
  activeTileLayer.bringToBack();

  if (def.overlay) {
    _hybridOverlay = L.tileLayer(def.overlay, def.overlayOpts || {}).addTo(map);
  }

  // Atualiza visual do painel
  document.querySelectorAll('.tile-opt').forEach(el =>
    el.classList.toggle('active', el.dataset.id === id)
  );
  // Salva preferência
  localStorage.setItem('fibermap-tile', id);
}

function buildTilePanel() {
  const panel = document.getElementById('tile-panel');
  panel.innerHTML = TILE_LAYERS.map(t => `
    <div class="tile-opt${t.id === currentTileId ? ' active' : ''}" data-id="${t.id}" onclick="setTileLayer('${t.id}');closeTilePanel()">
      <div class="tile-thumb"><img src="${t.thumb}" loading="lazy" onerror="this.style.display='none'"></div>
      <div class="tile-info">
        <div class="tile-name">${t.emoji} ${t.name}</div>
        <div class="tile-desc">${t.desc}</div>
      </div>
      <span class="tile-check">✓</span>
    </div>`).join('');
}

function toggleTilePanel() {
  const panel = document.getElementById('tile-panel');
  const btn   = document.getElementById('tile-btn');
  const isOpen = panel.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  if (isOpen) buildTilePanel();
}
function closeTilePanel() {
  document.getElementById('tile-panel').classList.remove('open');
  document.getElementById('tile-btn').classList.remove('open');
}

function initMap(){
  map = L.map('map', {
    center: [-15.8969, -52.2567],
    zoom: 13,
    minZoom: 3,
    maxZoom: 19,
    zoomControl: false,
    doubleClickZoom: false,
    preferCanvas: true
  });

  // Carrega tile salvo ou OSM padrão (usa setTileLayer para incluir overlay do híbrido)
  const savedTile = localStorage.getItem('fibermap-tile') || 'osm';
  setTileLayer(savedTile);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // disableClusteringAtZoom:18 garante que ao zoom 18+ cada poste/armário aparece
  // individualmente (não unificados em cluster). spiderfyOnMaxZoom espalha
  // sobreposições visuais quando o usuário clica no cluster.
  clusterPostes = L.markerClusterGroup({ maxClusterRadius: 50, disableClusteringAtZoom: 18, spiderfyOnMaxZoom: true });
  clusterArmarios = L.markerClusterGroup({ maxClusterRadius: 50, disableClusteringAtZoom: 18, spiderfyOnMaxZoom: true });
  map.addLayer(clusterPostes);
  map.addLayer(clusterArmarios);

  map.on('click', onMapClick);
  map.on('click', () => closeTilePanel()); // fecha painel de tiles ao clicar no mapa
  map.on('dblclick', onMapDblClick);
  map.on('mousemove', e => {
    document.getElementById('sblat').textContent = e.latlng.lat.toFixed(5);
    document.getElementById('sblng').textContent = e.latlng.lng.toFixed(5);
    // Preview cabo em traçado
    if(drawingCabo && caboPoints.length > 0) {
      const pts = [...caboPoints, [e.latlng.lat, e.latlng.lng]];
      if(caboPolyline) map.removeLayer(caboPolyline);
      caboPolyline = L.polyline(pts, {
        color: pendingCable ? pendingCable.color : '#1D9E75',
        weight: 3, opacity: 0.7, dashArray: '6,4'
      }).addTo(map);
    }
    // Preview linha de medição
    if(mode==='medida' && measurePoints.length>0 && !measurePaused){
      if(measurePreviewLine) map.removeLayer(measurePreviewLine);
      measurePreviewLine = L.polyline([...measurePoints,[e.latlng.lat,e.latlng.lng]],
        {color:'#F59E0B',weight:2,opacity:.7,dashArray:'8,5'}).addTo(map);
    }
  });
  map.on('zoomend', () => { document.getElementById('sbz').textContent = map.getZoom(); });
}

function setMode(m){
  // Recolhe automaticamente a bandeja de ferramentas ao escolher um modo
  var tt=document.getElementById('tray-tools');
  if(tt&&tt.classList.contains('show')){
    tt.classList.remove('show');
    var tb=document.getElementById('toggle-tools');
    if(tb)tb.classList.remove('active');
  }
  // Sai do modo medida se estava ativo
  if(mode==='medida' && m!=='medida') cancelMeasure();

  if(m==='cabo'){
    if(!drawingCabo){mode='cabo';openCableModal();}
    return;
  }
  if(drawingCabo)cancelCabo();

  // Painel de confirmação: mostra para Poste E Armário, esconde ao sair
  const postePanel=document.getElementById('poste-actions');
  if(postePanel){
    const showPanel=(m==='poste'||m==='armario');
    postePanel.classList.toggle('show',showPanel);
    const cBtn=document.getElementById('poste-confirm-btn');
    if(cBtn)cBtn.textContent=m==='armario'?'✓ Confirmar Armários':m==='poste'?'✓ Confirmar Postes':'✓ Confirmar';
  }
  // Painel de medir: mostra ao entrar no modo medida
  const medirPanel=document.getElementById('medir-actions');
  if(medirPanel) medirPanel.classList.toggle('show', m==='medida');

  mode=m;
  ['select','poste','cabo','armario','medida'].forEach(id=>{
    const btn=document.getElementById('btn-'+id);
    if(btn)btn.classList.toggle('act',id===m);
  });
  const labels={select:'Selecionar',poste:'Adicionar Poste — clique no mapa para inserir • Confirmar=sair',armario:'Adicionar Armário',cabo:'Traçar Cabo',medida:'Medir distância — clique para adicionar pontos • Enter=total • Esc=cancelar'};
  document.getElementById('sbm').textContent=labels[m]||m;

  if(m==='medida') startMeasure();
}

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

function buildPosteIcon(p){
  const children = (p && p.children) || [];
  let badgesHtml = '';
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
    html: `<div style="position:relative;width:28px;height:28px">${badgesHtml}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><path fill="#000000" d="m7 2l3 7h4l3-7zm6 18h3v2H8v-2h3V10h2z"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -28]
  });
}

const armarioIcon = L.divIcon({
  className: 'armario-icon',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="28" height="28"><g fill="none" stroke="#000000" stroke-width="4"><path stroke-linejoin="round" d="M42 4H6v10h36zm0 15H6v10h36zm0 15H6v10h36z"/><path stroke-linecap="round" d="M21 9h6m-6 15h6m-6 15h6"/></g></svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

function refreshPosteIcon(p){ if(p&&p.marker) p.marker.setIcon(buildPosteIcon(p)); }
function refreshArmarioIcon(a){ if(a&&a.marker) a.marker.setIcon(armarioIcon); }

function bindPosteTooltip(poste){
  if(!poste.marker)return;
  poste.marker.bindTooltip(()=>{
    const children=poste.children||[];
    if(!children.length)return poste.nome||poste.id;
    const ordem={emenda:1,deriv:2,cto:3};
    const sorted=[...children].sort((a,b)=>(ordem[a.tipo]||99)-(ordem[b.tipo]||99));
    const labels=sorted.map(c=>{const el=findById(c.id); return el?(el.nome||el.id):c.id;});
    return `<div class="poste-tooltip"><strong>${poste.nome||poste.id}</strong><br>${labels.join('<br>')}</div>`;
  },{direction:'top',offset:[0,-24]});
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
    opts: { attribution: '© OpenStreetMap', maxZoom: 21, subdomains: 'abc' },
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
    opts: { attribution: '© CartoDB', maxZoom: 20, subdomains: 'abcd' },
    thumb: 'https://a.basemaps.cartocdn.com/dark_all/10/376/564.png',
  },
  {
    id: 'carto-light',
    name: 'CartoDB Light',
    desc: 'Claro · leitura fácil',
    emoji: '☀️',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    opts: { attribution: '© CartoDB', maxZoom: 20, subdomains: 'abcd' },
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
    zoomControl: false,
    doubleClickZoom: false,
    preferCanvas: true
  });

  // Carrega tile salvo ou OSM padrão (usa setTileLayer para incluir overlay do híbrido)
  const savedTile = localStorage.getItem('fibermap-tile') || 'osm';
  setTileLayer(savedTile);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  clusterPostes = L.markerClusterGroup({ maxClusterRadius: 50 });
  clusterArmarios = L.markerClusterGroup({ maxClusterRadius: 50 });
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
    if(mode==='medida' && measurePoints.length>0){
      if(measurePreviewLine) map.removeLayer(measurePreviewLine);
      measurePreviewLine = L.polyline([...measurePoints,[e.latlng.lat,e.latlng.lng]],
        {color:'#F59E0B',weight:2,opacity:.7,dashArray:'8,5'}).addTo(map);
    }
  });
  map.on('zoomend', () => { document.getElementById('sbz').textContent = map.getZoom(); });
}

function setMode(m){
  // Sai do modo medida se estava ativo
  if(mode==='medida' && m!=='medida') cancelMeasure();

  if(m==='cabo'){
    if(!drawingCabo){mode='cabo';openCableModal();}
    return;
  }
  if(drawingCabo)cancelCabo();

  // Painel poste: mostra ao entrar, esconde ao sair
  const postePanel=document.getElementById('poste-actions');
  if(postePanel) postePanel.classList.toggle('show', m==='poste');

  mode=m;
  ['select','poste','cabo','armario','medida'].forEach(id=>{
    const btn=document.getElementById('btn-'+id);
    if(btn)btn.classList.toggle('act',id===m);
  });
  const labels={select:'Selecionar',poste:'Adicionar Poste — clique no mapa para inserir • Confirmar=sair',armario:'Adicionar Armário',cabo:'Traçar Cabo',medida:'Medir distância — clique para adicionar pontos • Enter=total • Esc=cancelar'};
  document.getElementById('sbm').textContent=labels[m]||m;

  if(m==='medida') startMeasure();
}

// ═══════════════════════════════════════════════
// tools.js — Medição, Geolocalização, Importação CSV
// ═══════════════════════════════════════════════

// ═══════ MEDIÇÃO DE DISTÂNCIA (interativa, arrastável) ═══════
let measureDots=[];     // L.marker arrastáveis (1 por ponto)
let measureSegLabels=[];// L.marker com tooltip de distância (1 por segmento)
let measurePaused=false;

function fmtDist(m){ return m>=1000?(m/1000).toFixed(3)+' km':Math.round(m)+' m'; }

function startMeasure(){
  clearMeasureGfx();
  measurePoints=[];
  document.getElementById('measure-total').classList.remove('show');
  var pa=document.getElementById('medir-actions');
  if(pa)pa.classList.add('show');
}
function cancelMeasure(){
  clearMeasureGfx();
  measurePoints=[];
  measurePaused=false;
  var pb=document.getElementById('medir-pause-btn');
  if(pb){pb.classList.remove('paused');pb.textContent='⏸ Anexar';}
  document.getElementById('measure-total').classList.remove('show');
  var pa=document.getElementById('medir-actions');
  if(pa)pa.classList.remove('show');
}
function clearMeasureGfx(){
  if(measurePolyline){map.removeLayer(measurePolyline);measurePolyline=null;}
  if(measurePreviewLine){map.removeLayer(measurePreviewLine);measurePreviewLine=null;}
  measureDots.forEach(d=>map.removeLayer(d));measureDots=[];
  measureSegLabels.forEach(l=>map.removeLayer(l));measureSegLabels=[];
  // compat legacy: measureLabels também é limpo
  if(typeof measureLabels!=='undefined'&&measureLabels){measureLabels.forEach(l=>{try{map.removeLayer(l);}catch(_){}}); measureLabels=[];}
}

function measureDotIcon(idx){
  return L.divIcon({
    className:'measure-dot',
    html:'<div class="m-dot-inner">'+(idx+1)+'</div>',
    iconSize:[22,22],iconAnchor:[11,11]
  });
}

function addMeasurePoint(lat,lng){
  measurePoints.push([lat,lng]);
  var idx=measurePoints.length-1;
  var dot=L.marker([lat,lng],{
    icon:measureDotIcon(idx),draggable:true,
    autoPan:true,keyboard:false,zIndexOffset:1000
  }).addTo(map);
  // Popup com distância para o ponto anterior
  dot.bindPopup(buildMeasurePopup(idx),{closeButton:false,autoClose:false,closeOnClick:false,offset:[0,-12]});
  dot.on('drag',function(){
    var ll=dot.getLatLng();
    measurePoints[idx]=[ll.lat,ll.lng];
    redrawMeasure();
  });
  dot.on('dragend',function(){
    dot.setPopupContent(buildMeasurePopup(idx));
    var next=measureDots[idx+1];
    if(next)next.setPopupContent(buildMeasurePopup(idx+1));
  });
  dot.on('click',function(e){
    L.DomEvent.stopPropagation(e);
    dot.openPopup();
  });
  measureDots.push(dot);
  redrawMeasure();
  // Abre popup do ponto recém-criado pra mostrar a distância
  setTimeout(function(){dot.openPopup();},10);
}

function buildMeasurePopup(idx){
  if(idx===0)return '<div class="m-pop"><b>Ponto 1</b><br><span style="color:#9ca3af">início</span></div>';
  var segDist=L.latLng(measurePoints[idx-1]).distanceTo(L.latLng(measurePoints[idx]));
  var totalUntilHere=0;
  for(var i=1;i<=idx;i++) totalUntilHere+=L.latLng(measurePoints[i-1]).distanceTo(L.latLng(measurePoints[i]));
  return '<div class="m-pop"><b>Ponto '+(idx+1)+'</b>'+
    '<br><span class="m-pop-seg">↔ anterior: <b>'+fmtDist(segDist)+'</b></span>'+
    '<br><span class="m-pop-tot">Σ até aqui: '+fmtDist(totalUntilHere)+'</span></div>';
}

function redrawMeasure(){
  // Atualiza polyline
  if(measurePolyline){map.removeLayer(measurePolyline);measurePolyline=null;}
  if(measurePoints.length>=2){
    measurePolyline=L.polyline(measurePoints,{color:'#F59E0B',weight:3,opacity:.9,dashArray:'10,6'}).addTo(map);
  }
  // Atualiza labels de segmento
  measureSegLabels.forEach(l=>map.removeLayer(l));measureSegLabels=[];
  for(var i=1;i<measurePoints.length;i++){
    var seg=L.latLng(measurePoints[i-1]).distanceTo(L.latLng(measurePoints[i]));
    var mid=[(measurePoints[i-1][0]+measurePoints[i][0])/2,(measurePoints[i-1][1]+measurePoints[i][1])/2];
    var distText=fmtDist(seg);
    var approxW=Math.max(58,distText.length*9+24);
    var lbl=L.marker(mid,{icon:L.divIcon({className:'measure-label',html:'📏 '+distText,iconSize:[approxW,26],iconAnchor:[approxW/2,13]}),interactive:false,zIndexOffset:500}).addTo(map);
    measureSegLabels.push(lbl);
  }
  showMeasureTotal();
}

function showMeasureTotal(){
  var el=document.getElementById('measure-total');
  if(measurePoints.length<2){el.classList.remove('show');return;}
  var d=0;for(var i=1;i<measurePoints.length;i++) d+=L.latLng(measurePoints[i-1]).distanceTo(L.latLng(measurePoints[i]));
  el.textContent='📏 Total: '+fmtDist(d)+'  ('+measurePoints.length+' pontos · arraste os pontos para ajustar)';
  el.classList.add('show');
}

function finishMeasure(){
  // No novo fluxo, "Sair do modo medir" limpa tudo
  cancelMeasure();
  measurePaused=false;
  setMode('select');
}

function toggleMeasurePause(){
  measurePaused=!measurePaused;
  var btn=document.getElementById('medir-pause-btn');
  if(btn){
    btn.classList.toggle('paused',measurePaused);
    btn.textContent=measurePaused?'▶ Retomar':'⏸ Anexar';
    btn.title=measurePaused?'Click para retomar adição de pontos':'Click para pausar (mouse/toque não adiciona pontos)';
  }
  if(measurePreviewLine){map.removeLayer(measurePreviewLine);measurePreviewLine=null;}
  showToast(measurePaused?'⏸ Adição de pontos PAUSADA — arraste pontos existentes ou retome':'▶ Adição de pontos retomada','info');
}

function removeLastMeasurePoint(){
  if(measurePoints.length===0)return;
  measurePoints.pop();
  var last=measureDots.pop();
  if(last){try{map.removeLayer(last);}catch(e){}}
  // Recalcula tudo
  redrawMeasure();
  // Atualiza popup do ponto que agora virou último (a distância dele pode ter mudado contextualmente — não, mas mesmo assim)
  var dotN=measureDots[measureDots.length-1];
  if(dotN)dotN.setPopupContent(buildMeasurePopup(measureDots.length-1));
  showToast('↩ Último ponto removido','info');
}

function askExitMeasure(){
  if(measurePoints.length===0){finishMeasure();return;}
  document.getElementById('medir-exit-conf').style.display='flex';
}
function closeExitMeasure(){
  document.getElementById('medir-exit-conf').style.display='none';
}
function confirmExitMeasure(){
  document.getElementById('medir-exit-conf').style.display='none';
  finishMeasure();
}

// ═══════ HISTÓRICO DE MUDANÇAS ═══════
function toggleHistoryPanel(){
  const p=document.getElementById('history-panel');
  const isOpen=p.classList.toggle('show');
  const btn=document.getElementById('btn-historico');
  if(btn)btn.classList.toggle('act',isOpen);
  // Ao abrir histórico, recolhe a bandeja de ferramentas pra dar destaque ao popup
  if(isOpen){
    const tt=document.getElementById('tray-tools');
    if(tt&&tt.classList.contains('show')){
      tt.classList.remove('show');
      const tb=document.getElementById('toggle-tools');
      if(tb)tb.classList.remove('active');
    }
    renderHistoryPanel();
  }
}
function relTime(ts){
  const d=Date.now()-ts;
  if(d<60000) return 'agora';
  if(d<3600000) return `há ${Math.floor(d/60000)}min`;
  if(d<86400000) return `há ${Math.floor(d/3600000)}h`;
  return `há ${Math.floor(d/86400000)}d`;
}
function renderHistoryPanel(){
  const list=document.getElementById('history-list');
  const stack=[...stateManager.undoStack].reverse(); // mais recente primeiro
  if(!stack.length){
    list.innerHTML='<div style="padding:14px;font-size:11px;color:var(--text3);font-family:var(--mono);text-align:center">Nenhuma ação registrada</div>';
    return;
  }
  list.innerHTML=stack.map((s,i)=>{
    const isCurrent=i===0;
    const ico={
      'Criar':'🟢','Mover':'📍','Deletar':'🔴','Alterar':'✏️','Criar Cabo':'🟡',
      'Criar Armário':'🗄️','Criar Poste':'📡','Limpar':'🗑️'
    };
    const icon=Object.entries(ico).find(([k])=>s._label&&s._label.startsWith(k))?.[1]||'🔵';
    return `<div class="hitem${isCurrent?' current':''}" title="${s._label||'Ação'}">
      <div class="hdot" style="background:${isCurrent?'var(--green)':'var(--text3)'}"></div>
      <span style="flex:1;font-family:var(--mono);font-size:11px">${icon} ${s._label||'Ação'}</span>
      <span class="htime">${s._ts?relTime(s._ts):'—'}</span>
    </div>`;
  }).join('');
  // Atualiza tempo a cada 30s enquanto painel aberto
  clearTimeout(historyRefreshTimer);
  if(document.getElementById('history-panel').classList.contains('show'))
    historyRefreshTimer=setTimeout(renderHistoryPanel,30000);
}
let historyRefreshTimer;

function updateUndoRedoUI(){
  if(document.getElementById('history-panel').classList.contains('show'))
    renderHistoryPanel();
}

// ═══════ GEOLOCALIZAÇÃO ═══════
// ═══════ GEOLOCALIZAÇÃO ═══════
let _geoSamples=[], _geoSampleTimer=null, _geoCentered=false;

function toggleGeolocation(){
  const btn=document.getElementById('geo-btn');

  // ── Desativar ──
  if(geoWatchId!==null){
    navigator.geolocation.clearWatch(geoWatchId); geoWatchId=null;
    clearTimeout(_geoSampleTimer); _geoSamples=[];
    if(geoMarker){map.removeLayer(geoMarker);geoMarker=null;}
    if(geoCircle){map.removeLayer(geoCircle);geoCircle=null;}
    btn.classList.remove('active'); btn.textContent='📍'; btn.title='Minha posição';
    showToast('Geolocalização desativada','warning');
    return;
  }
  if(!navigator.geolocation){showToast('Geolocalização não suportada neste dispositivo','error');return;}

  // ── Ativar ──
  btn.textContent='⌛'; btn.title='Localizando…';
  _geoSamples=[]; _geoCentered=false;

  const onSuccess = pos => {
    const {latitude:lat, longitude:lng, accuracy} = pos.coords;

    // Acumula amostras para filtrar a melhor
    _geoSamples.push({lat, lng, accuracy, ts: Date.now()});
    // Descarta amostras com mais de 8s
    _geoSamples = _geoSamples.filter(s => Date.now()-s.ts < 8000);

    // Usa a amostra com MENOR raio de acurácia das últimas 8s
    const best = _geoSamples.reduce((a,b) => a.accuracy <= b.accuracy ? a : b);

    applyGeoPosition(best.lat, best.lng, best.accuracy);
    btn.classList.add('active'); btn.textContent='📍'; btn.title=`Precisão: ~${Math.round(best.accuracy)}m`;
  };

  const onError = err => {
    // Só mostra erro se ainda não tiver nenhuma posição
    if(!geoMarker){
      btn.textContent='📍'; btn.title='Minha posição';
      btn.classList.remove('active');
      const msgs={1:'Permissão negada — habilite a localização no navegador',2:'Posição indisponível',3:'Timeout — tente ao ar livre'};
      showToast(`📍 ${msgs[err.code]||'Erro de geolocalização'}`,'error');
    }
  };

  // Disparo 1: rápido (cache até 3s) — aparece imediatamente
  navigator.geolocation.getCurrentPosition(onSuccess, ()=>{}, {
    enableHighAccuracy: false, timeout: 5000, maximumAge: 3000
  });

  // Disparo 2: GPS real (sem cache) — chega em seguida com mais precisão
  navigator.geolocation.getCurrentPosition(onSuccess, onError, {
    enableHighAccuracy: true, timeout: 15000, maximumAge: 0
  });

  // watchPosition: mantém rastreamento contínuo em campo
  geoWatchId = navigator.geolocation.watchPosition(onSuccess, onError, {
    enableHighAccuracy: true, timeout: 10000, maximumAge: 2000
  });
}

function applyGeoPosition(lat, lng, accuracy){
  if(geoMarker) map.removeLayer(geoMarker);
  if(geoCircle) map.removeLayer(geoCircle);

  // Círculo de incerteza (raio = acurácia em metros)
  geoCircle = L.circle([lat,lng], {
    radius: accuracy,
    color: '#06B6D4', fillColor: '#06B6D4',
    fillOpacity: 0.08, weight: 1.5, dashArray: '4,4'
  }).addTo(map);

  // Marcador pulsante via divIcon
  geoMarker = L.marker([lat,lng], {
    icon: L.divIcon({
      className: '',
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#06B6D4;border:3px solid #fff;
        box-shadow:0 0 0 3px rgba(6,182,212,.35), 0 2px 8px rgba(0,0,0,.5);
        animation:geoPulse 2s ease-in-out infinite;
      "></div>`,
      iconSize: [18,18], iconAnchor: [9,9]
    }),
    zIndexOffset: 1000
  }).addTo(map);

  geoMarker.bindTooltip(
    `📍 Você está aqui<br><span style="font-size:10px;color:#8b949e">Precisão: ~${Math.round(accuracy)} m</span>`,
    {direction:'top', className:'poste-tooltip', offset:[0,-4]}
  );

  // Centraliza apenas na primeira leitura
  if(!_geoCentered){
    _geoCentered = true;
    const zoom = accuracy < 30 ? 18 : accuracy < 100 ? 17 : accuracy < 500 ? 16 : 15;
    map.setView([lat, lng], zoom, {animate: true});
  }
}

// ═══════ IMPORTAÇÃO CSV ═══════
let csvParsedData=[];
function loadCSV(evt){
  const file=evt.target.files[0]; if(!file)return; evt.target.value='';
  const r=new FileReader();
  r.onload=e=>{
    const text=e.target.result;
    parseAndPreviewCSV(text);
  };
  r.readAsText(file,'UTF-8');
}
function parseAndPreviewCSV(text){
  // Auto-detecta separador
  const sep=text.includes(';')?';':',';
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2){showToast('CSV vazio ou inválido','error');return;}

  // Header
  const headers=lines[0].split(sep).map(h=>h.trim().toLowerCase().replace(/['"]/g,''));
  const requiredCols=['tipo','nome','lat','lng'];
  const missing=requiredCols.filter(c=>!headers.includes(c));
  if(missing.length){showToast(`CSV sem colunas: ${missing.join(', ')}`,'error');return;}

  const rows=[];
  for(let i=1;i<lines.length;i++){
    const vals=lines[i].split(sep).map(v=>v.trim().replace(/^["']|["']$/g,''));
    if(vals.length<4||!vals[headers.indexOf('lat')]||!vals[headers.indexOf('lng')])continue;
    const get=col=>vals[headers.indexOf(col)]||'';
    const lat=parseFloat(get('lat')), lng=parseFloat(get('lng'));
    const tipo=(get('tipo')||'').toLowerCase();
    const errs=[];
    if(isNaN(lat)||lat<-90||lat>90) errs.push('lat inválida');
    if(isNaN(lng)||lng<-180||lng>180) errs.push('lng inválida');
    if(!['poste','armario'].includes(tipo)) errs.push('tipo deve ser "poste" ou "armario"');
    rows.push({tipo,nome:get('nome'),lat,lng,obs:get('obs'),capacidade:get('capacidade'),portas:get('portas'),_row:i+1,_errs:errs});
  }
  csvParsedData=rows;

  // Montar preview
  const ok=rows.filter(r=>!r._errs.length).length;
  const err=rows.filter(r=>r._errs.length).length;
  document.getElementById('csv-summary').innerHTML=
    `<span class="csv-badge ok">✓ ${ok|0} prontos para importar</span>`+
    (err?`<span class="csv-badge err">✗ ${err|0} com erro</span>`:'')+
    `<span style="color:var(--text3);font-size:10px;margin-left:auto">Total: ${rows.length|0} linhas lidas</span>`;

  document.getElementById('csv-thead').innerHTML=
    `<th>#</th><th>Tipo</th><th>Nome</th><th>Lat</th><th>Lng</th><th>Obs</th><th>Status</th>`;
  document.getElementById('csv-tbody').innerHTML=rows.slice(0,200).map(r=>{
    const st=r._errs.length
      ?`<td class="err">✗ ${r._errs.join(', ')}</td>`
      :`<td class="ok">✓ OK</td>`;
    return `<tr><td class="${r._errs.length?'err':''}">${r._row}</td>
      <td class="${r._errs.length?'err':r.tipo==='armario'?'warn':'ok'}">${escH(r.tipo)}</td>
      <td>${escH(r.nome||'—')}</td><td>${r.lat}</td><td>${r.lng}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis">${escH(r.obs||'—')}</td>${st}</tr>`;
  }).join('');

  document.getElementById('csv-import-btn').disabled=ok===0;
  document.getElementById('csv-overlay').classList.add('show');
}
function closeCSVModal(){ document.getElementById('csv-overlay').classList.remove('show'); csvParsedData=[]; }
function confirmCSVImport(){
  const valid=csvParsedData.filter(r=>!r._errs.length);
  if(!valid.length){showToast('Nenhuma linha válida para importar','error');return;}
  stateManager.pushState(`Importar CSV (${valid.length} elementos)`);
  let np=0,na=0;
  valid.forEach(r=>{
    if(r.tipo==='poste') { addPoste(r.lat,r.lng,{nome:r.nome,obs:r.obs,_restoring:false}); np++; }
    else if(r.tipo==='armario') { addArmario(r.lat,r.lng,{nome:r.nome,obs:r.obs,capacidade:parseInt(r.capacidade)||24,_restoring:false}); na++; }
  });
  closeCSVModal();
  const parts=[];
  if(np) parts.push(`${np} poste${np>1?'s':''}`);
  if(na) parts.push(`${na} armário${na>1?'s':''}`);
  showToast(`✓ Importados: ${parts.join(' + ')}`, 'success');
  if(valid.length) map.fitBounds(L.latLngBounds(valid.map(r=>[r.lat,r.lng])),{padding:[40,40]});
}
function downloadCSVTemplate(){
  const csv='tipo,nome,lat,lng,obs,capacidade,portas\nposte,Poste 01,-15.98100,-52.26000,Poste de concreto,,\nposte,Poste 02,-15.98200,-52.25900,,,\narmario,Armário A,-15.98000,-52.26100,,24,\n';
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='modelo_importacao.csv'; a.click();
}

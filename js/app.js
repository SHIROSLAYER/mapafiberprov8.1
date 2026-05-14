// ═══════════════════════════════════════════════
// app.js — Inicialização, Atalhos de Teclado e Event Listeners
// ═══════════════════════════════════════════════

// ═══════ KEYBOARD ═══════
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){ e.preventDefault(); undoAction(); }
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))){ e.preventDefault(); redoAction(); }
  if(e.key==='Escape'){
    if(document.getElementById('csv-overlay').classList.contains('show')){closeCSVModal();return;}
    if(document.getElementById('history-panel').classList.contains('show')){toggleHistoryPanel();return;}
    if(document.getElementById('em-overlay').classList.contains('show')){closeEmModal();return;}
    if(document.getElementById('sub-overlay').style.display==='flex'){closeSubModal();return;}
    if(document.getElementById('cable-overlay').classList.contains('show')){closeCableModal();return;}
    if(document.getElementById('conf-overlay').classList.contains('show')){confCancel();return;}
    if(document.getElementById('alterar-cabo-overlay').style.display==='flex'){closeAlterarCaboModal();return;}
    if(typeof _editAnchor!=='undefined'&&_editAnchor&&_editAnchor.cable){closeCableAnchoringEdit();return;}
    if(typeof _pathAnimLayers!=='undefined'&&_pathAnimLayers&&_pathAnimLayers.length){closeCablePath();return;}
    if(mode==='medida'){cancelMeasure();setMode('select');return;}
    if(drawingCabo)cancelCabo();
    return;
  }
  if((e.key==='Backspace')&&drawingCabo&&caboPoints.length>0){
    e.preventDefault();
    const removed=caboPoints.pop();
    if(pendingCable.anchors.length>0){
      const lastAnchor=pendingCable.anchors[pendingCable.anchors.length-1];
      const anchorElem=anchorables().find(a=>a.id===lastAnchor);
      if(anchorElem&&Math.abs(anchorElem.lat-removed[0])<0.000001&&Math.abs(anchorElem.lng-removed[1])<0.000001){pendingCable.anchors.pop();}
    }
    if(tempDots.length>0){map.removeLayer(tempDots.pop());}
    if(caboPolyline){map.removeLayer(caboPolyline);caboPolyline=null;}
    if(caboPoints.length>1){caboPolyline=L.polyline(caboPoints,{color:pendingCable.color,weight:3,opacity:.7,dashArray:'6,4'}).addTo(map);}
    document.getElementById('sbm').textContent=`${pendingCable.id} — ${caboPoints.length} pontos (${pendingCable.anchors.length} âncoras) • Enter=finalizar`;
    return;
  }
  const km={s:'select',p:'poste',c:'cabo',a:'armario',m:'medida'};
  if(km[e.key]){setMode(km[e.key]);return;}
  if(e.key==='Enter'){
    if(drawingCabo&&caboPoints.length>=2){finishCabo();}
  }
  if((e.key==='Delete')&&selectedElem){e.preventDefault();askRemove(selectedElem);}
});

// Fechar modais ao clicar fora
document.getElementById('em-overlay').addEventListener('click',function(e){if(e.target===this)closeEmModal();});
document.getElementById('cable-overlay').addEventListener('click',function(e){if(e.target===this)closeCableModal();});
document.getElementById('conf-overlay').addEventListener('click',function(e){if(e.target===this)confCancel();});
document.getElementById('sub-overlay').addEventListener('click',function(e){if(e.target===this)closeSubModal();});
document.getElementById('alterar-cabo-overlay').addEventListener('click',function(e){if(e.target===this)closeAlterarCaboModal();});
document.getElementById('csv-overlay').addEventListener('click',function(e){if(e.target===this)closeCSVModal();});

// ═══════ INICIALIZAÇÃO ═══════
window.addEventListener('load',()=>{
  // Tema fixo escuro (botão de alternância removido)
  isDarkMode = true;
  document.documentElement.style.filter = '';
  localStorage.setItem('fibermap-theme', 'dark');
  // Mostra modal de novidades. Sempre aparece quando a versão muda,
  // mesmo se o usuário marcou "não mostrar novamente" em versão anterior.
  var vBadge=document.getElementById('welcome-version');
  if(vBadge)vBadge.textContent='v'+WELCOME_VERSION;
  var seenVer=localStorage.getItem('fibermap-welcome-seen-version');
  if(seenVer!==WELCOME_VERSION){
    document.getElementById('welcome-overlay').classList.add('show');
  }
  initMap();
  buildCableTypeGrid();
  if(!loadProjectFromLocal()){updStats();debouncedUpdList();}
  updCableLegend();
  setTimeout(()=>{try{map.invalidateSize(true);}catch(_){}},80);
});

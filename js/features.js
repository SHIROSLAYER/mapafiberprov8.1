// ═══════════════════════════════════════════════
// features.js — Quick wins: help, drag-drop, readonly, clipboard,
//               confirm reforçado, snapshot F2, print, layers, alertas
// ═══════════════════════════════════════════════

// ─── 1. Modo somente-leitura via ?view=1 ───
const READONLY = new URLSearchParams(location.search).get('view') === '1';
if (READONLY) {
  document.documentElement.classList.add('readonly');
  // Aplica display:none nos botões mutáveis via CSS (.readonly hide)
}

// ─── 2. Modal de ajuda com atalhos (?) ───
function showHelpModal(){
  let ov = document.getElementById('help-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'help-overlay';
    ov.className = 'help-overlay';
    ov.addEventListener('click', e => { if (e.target === ov) closeHelpModal(); });
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div class="help-modal">
      <div class="help-hdr">
        <h2>⌨️ Atalhos & Ajuda</h2>
        <button class="cc-close" onclick="closeHelpModal()">✕</button>
      </div>
      <div class="help-body">
        <section>
          <h3>Modos</h3>
          <div class="kb"><kbd>S</kbd> Selecionar</div>
          <div class="kb"><kbd>P</kbd> Adicionar Poste</div>
          <div class="kb"><kbd>A</kbd> Adicionar Armário</div>
          <div class="kb"><kbd>C</kbd> Traçar Cabo</div>
          <div class="kb"><kbd>M</kbd> Medir</div>
        </section>
        <section>
          <h3>Edição</h3>
          <div class="kb"><kbd>Ctrl</kbd>+<kbd>Z</kbd> Desfazer</div>
          <div class="kb"><kbd>Ctrl</kbd>+<kbd>Y</kbd> Refazer</div>
          <div class="kb"><kbd>Delete</kbd> Remover selecionado</div>
          <div class="kb"><kbd>Esc</kbd> Cancelar / sair</div>
          <div class="kb"><kbd>Enter</kbd> Finalizar/confirmar (cabo, poste, armário)</div>
          <div class="kb"><kbd>Backspace</kbd> Remover último ponto (medir/cabo)</div>
        </section>
        <section>
          <h3>Rápido</h3>
          <div class="kb"><kbd>F1</kbd> ou <kbd>?</kbd> Esta tela</div>
          <div class="kb"><kbd>F2</kbd> Exportar snapshot rápido</div>
          <div class="kb"><kbd>F3</kbd> Backups automáticos</div>
          <div class="kb"><kbd>Ctrl</kbd>+<kbd>P</kbd> Modo impressão (navegador)</div>
        </section>
        <section>
          <h3>Mapa</h3>
          <div class="kb">Duplo-toque elemento: abrir propriedades</div>
          <div class="kb">Toque simples: ver dados</div>
          <div class="kb">Arrastar elemento: mover (pede confirmação)</div>
          <div class="kb">Arrastar fundo: pan</div>
          <div class="kb">Scroll/pinça: zoom</div>
        </section>
        <section>
          <h3>Diagrama de fibras</h3>
          <div class="kb">Toque na fibra: card de info</div>
          <div class="kb">Duplo-toque na fibra: caminho completo</div>
          <div class="kb">Arrastar fibra→fibra: conectar (Modo Edição)</div>
        </section>
        <section>
          <h3>Importar arquivos</h3>
          <div class="kb">Arraste KML/JSON direto pro mapa</div>
        </section>
      </div>
    </div>`;
  ov.classList.add('show');
}
function closeHelpModal(){const ov=document.getElementById('help-overlay');if(ov)ov.classList.remove('show');}

// ─── 3. Drag & drop de arquivos no mapa ───
function setupFileDrop(){
  const target=document.getElementById('map');
  if(!target)return;
  let dragHint=null;
  function showHint(){
    if(dragHint)return;
    dragHint=document.createElement('div');
    dragHint.className='drop-hint';
    dragHint.innerHTML='<div class="drop-hint-inner">📂<br>Solte arquivo<br><span>KML, KMZ, JSON, CSV</span></div>';
    document.body.appendChild(dragHint);
  }
  function hideHint(){if(dragHint){dragHint.remove();dragHint=null;}}
  ['dragenter','dragover'].forEach(ev=>{
    window.addEventListener(ev,e=>{
      if(e.dataTransfer&&Array.from(e.dataTransfer.types||[]).includes('Files')){
        e.preventDefault();showHint();
      }
    });
  });
  ['dragleave','drop'].forEach(ev=>{
    window.addEventListener(ev,e=>{
      if(ev==='dragleave'&&e.clientX>0&&e.clientY>0)return;
      hideHint();
    });
  });
  window.addEventListener('drop',e=>{
    if(!e.dataTransfer||!e.dataTransfer.files||!e.dataTransfer.files.length)return;
    e.preventDefault();hideHint();
    const f=e.dataTransfer.files[0];
    const name=(f.name||'').toLowerCase();
    if(name.endsWith('.json')){
      const r=new FileReader();
      r.onload=ev=>{try{const snap=JSON.parse(ev.target.result);applyProjectSnapshot(snap);saveProjectToLocal();showToast('✓ Projeto importado: '+f.name,'success');}catch(_){showToast('✗ JSON inválido','error');}};
      r.readAsText(f);
    }else if(name.endsWith('.kml')||name.endsWith('.kmz')){
      const fakeInput={files:[f]};
      loadKML({target:fakeInput});
    }else if(name.endsWith('.csv')||name.endsWith('.txt')){
      loadCSV({target:{files:[f],value:''}});
    }else{
      showToast('Formato não suportado. Use KML, KMZ, JSON ou CSV.','warning');
    }
  });
}

// ─── 4. Confirmação reforçada para Limpar ───
function askClearStrong(){
  const ov=document.getElementById('strong-clear-overlay')||(()=>{
    const d=document.createElement('div');
    d.id='strong-clear-overlay';
    d.className='strong-clear-overlay';
    d.addEventListener('click',e=>{if(e.target===d)closeStrongClear();});
    document.body.appendChild(d);
    return d;
  })();
  ov.innerHTML=`
    <div class="sc-modal">
      <div class="sc-hdr">⚠️ Limpar TUDO</div>
      <p>Isso remove todos os <b>${armarios.length} armários</b>, <b>${postes.length} postes</b>, <b>${cabos.length} cabos</b> e suas conexões.</p>
      <p>Para confirmar, digite <code>LIMPAR</code> abaixo:</p>
      <input type="text" id="sc-input" class="cm-input" placeholder="Digite LIMPAR" autocomplete="off" oninput="onStrongClearInput(this)">
      <div class="sc-actions">
        <button class="cm-btn" onclick="closeStrongClear()">Cancelar</button>
        <button class="cm-btn primary" id="sc-confirm" disabled onclick="doStrongClear()">Limpar Tudo</button>
      </div>
      <p class="sc-tip">💡 Pro tip: faça download do projeto antes (botão ↓ Projeto na bandeja de ferramentas).</p>
    </div>`;
  ov.classList.add('show');
  setTimeout(()=>{const i=document.getElementById('sc-input');if(i)i.focus();},50);
}
function onStrongClearInput(el){
  document.getElementById('sc-confirm').disabled = (el.value.trim().toUpperCase()!=='LIMPAR');
}
function closeStrongClear(){const ov=document.getElementById('strong-clear-overlay');if(ov)ov.classList.remove('show');}
function doStrongClear(){
  closeStrongClear();
  stateManager.pushState('Limpar Tudo');
  armarios.forEach(p=>clusterArmarios.removeLayer(p.marker));armarios=[];
  postes.forEach(p=>clusterPostes.removeLayer(p.marker));postes=[];
  ctos=[];emendas=[];derivs=[];olts=[];mpls=[];
  cabos.forEach(c=>map.removeLayer(c.poly));cabos=[];
  connections.forEach(c=>map.removeLayer(c.line));connections=[];
  cleanupCabo();pcnt=0;ctocnt=0;emcnt=0;dcnt=0;cabocnt=0;oltcnt=0;armcnt=0;mplscnt=0;selectedElem=null;
  updStats();debouncedUpdList();updCableLegend();saveProjectToLocal();
  showToast('✓ Projeto limpo','success');
}

// ─── 5. Snapshot rápido (F2) ───
function quickSnapshot(){
  try{
    const snap=buildProjectSnapshot();
    const blob=new Blob([JSON.stringify(snap,null,2)],{type:'application/json'});
    const d=new Date();
    const stamp=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+'-'+String(d.getMinutes()).padStart(2,'0');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='fibermap_snapshot_'+stamp+'.json';
    a.click();URL.revokeObjectURL(a.href);
    showToast('💾 Snapshot baixado: '+a.download,'success');
  }catch(e){showToast('Falha no snapshot: '+e.message,'error');}
}

// ─── 6. Coordenadas clicáveis (copy to clipboard) ───
// Adiciona handler global em qualquer elemento com data-copy
document.addEventListener('click', function(e){
  const t=e.target.closest&&e.target.closest('[data-copy]');
  if(!t)return;
  const txt=t.dataset.copy;
  if(!txt)return;
  e.stopPropagation();
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(()=>showToast('📋 Copiado: '+txt,'success')).catch(()=>showToast('Falha ao copiar','error'));
  }else{
    // Fallback
    const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');showToast('📋 Copiado: '+txt,'success');}catch(_){showToast('Falha ao copiar','error');}
    ta.remove();
  }
});

// ─── 7. Print mode (impressão limpa do mapa) ───
function togglePrintMode(){
  document.body.classList.toggle('print-mode');
  if(document.body.classList.contains('print-mode')){
    showToast('🖨️ Modo Impressão — Ctrl+P para imprimir, Esc para sair','info');
  }
}

// ─── 8. Layer toggles (mostrar/esconder por tipo) ───
const _layerVisible={poste:true,armario:true,cabo:true,emenda:true,cto:true,deriv:true};
function toggleLayer(tipo){
  _layerVisible[tipo]=!_layerVisible[tipo];
  applyLayerVisibility();
  const btn=document.getElementById('lyr-'+tipo);
  if(btn)btn.classList.toggle('off',!_layerVisible[tipo]);
  showToast((_layerVisible[tipo]?'👁 Mostrando ':'🚫 Ocultando ')+tipo,'info');
}
function applyLayerVisibility(){
  // Cabos
  cabos.forEach(c=>{
    if(!c.poly)return;
    if(_layerVisible.cabo&&!map.hasLayer(c.poly))c.poly.addTo(map);
    else if(!_layerVisible.cabo&&map.hasLayer(c.poly))map.removeLayer(c.poly);
  });
  // Postes (via cluster)
  if(clusterPostes){
    if(_layerVisible.poste&&!map.hasLayer(clusterPostes))map.addLayer(clusterPostes);
    else if(!_layerVisible.poste&&map.hasLayer(clusterPostes))map.removeLayer(clusterPostes);
  }
  if(clusterArmarios){
    if(_layerVisible.armario&&!map.hasLayer(clusterArmarios))map.addLayer(clusterArmarios);
    else if(!_layerVisible.armario&&map.hasLayer(clusterArmarios))map.removeLayer(clusterArmarios);
  }
}

// ─── 9. Banner de alertas (atenuação excedida, conexões órfãs) ───
function checkAlerts(){
  const alerts=[];
  // Atenuação acima do budget
  cabos.forEach(c=>{
    if(typeof calcAtt!=='function')return;
    const a=calcAtt(c);
    if(a.margin<0){
      alerts.push({tipo:'error',texto:`Cabo ${c.nome||c.id}: atenuação ${a.tot.toFixed(1)} dB excede budget (${ATT.budget} dB)`,id:c.id});
    }else if(a.margin<3){
      alerts.push({tipo:'warn',texto:`Cabo ${c.nome||c.id}: margem apertada (${a.margin.toFixed(1)} dB)`,id:c.id});
    }
  });
  // Conexões órfãs (referenciam IDs inexistentes)
  let orphans=0;
  [].concat(postes||[],armarios||[]).forEach(d=>{
    ((d.fibers||{}).connections||[]).forEach(conn=>{
      const checkEid=(eid)=>{
        if(eid.startsWith('cable:')){
          const rawId=eid.slice(6).replace('::I','').replace('::O','');
          return !!cabos.find(c=>c.id===rawId);
        }
        if(eid.startsWith('in:')||eid.startsWith('out:')){
          const sid=eid.slice(eid.indexOf(':')+1);
          return !!findById(sid);
        }
        return true;
      };
      if(!checkEid(conn.fromId)||!checkEid(conn.toId))orphans++;
    });
  });
  if(orphans>0)alerts.push({tipo:'warn',texto:`${orphans} conexão(ões) órfã(s) detectada(s) — abra um diagrama para limpá-las automaticamente`,id:null});
  renderAlertsBanner(alerts);
}
function renderAlertsBanner(alerts){
  let bn=document.getElementById('alerts-banner');
  if(!alerts.length){if(bn)bn.style.display='none';return;}
  if(!bn){
    bn=document.createElement('div');bn.id='alerts-banner';bn.className='alerts-banner';
    document.body.appendChild(bn);
  }
  const hi=alerts.filter(a=>a.tipo==='error').length;
  const tone=hi>0?'error':'warn';
  bn.className='alerts-banner '+tone;
  bn.innerHTML=`<span class="alerts-icon">${hi>0?'⛔':'⚠️'}</span>
    <span class="alerts-count">${alerts.length|0}</span>
    <span class="alerts-summary">${escH(alerts[0].texto)}${alerts.length>1?` <span style="opacity:.7">(+${alerts.length-1} mais)</span>`:''}</span>
    <button class="alerts-x" onclick="hideAlertsBanner()">✕</button>`;
  bn.style.display='flex';
  bn.onclick=function(e){if(e.target.classList.contains('alerts-x'))return;showAlertsList(alerts);};
}
function hideAlertsBanner(){const bn=document.getElementById('alerts-banner');if(bn)bn.style.display='none';}
function showAlertsList(alerts){
  const ov=document.getElementById('alerts-overlay')||(()=>{
    const d=document.createElement('div');d.id='alerts-overlay';d.className='help-overlay';
    d.addEventListener('click',e=>{if(e.target===d)d.classList.remove('show');});
    document.body.appendChild(d);return d;
  })();
  const rows=alerts.map(a=>{
    const click=a.id?`onclick="zoomTo('${escJs(a.id)}');document.getElementById('alerts-overlay').classList.remove('show')"`:'';
    return `<div class="al-row al-${a.tipo}" ${click}><span>${a.tipo==='error'?'⛔':'⚠️'}</span><span>${escH(a.texto)}</span>${a.id?'<span class="al-arrow">→</span>':''}</div>`;
  }).join('');
  ov.innerHTML=`<div class="help-modal" style="max-width:520px"><div class="help-hdr"><h2>⚠️ Alertas (${alerts.length|0})</h2><button class="cc-close" onclick="document.getElementById('alerts-overlay').classList.remove('show')">✕</button></div><div class="help-body">${rows}</div></div>`;
  ov.classList.add('show');
}

// ─── 10. Index de conexões em Map para perf (O(1) lookup) ───
// Função invocada quando muda o popup do diagrama. O fiber.js usa isConn local,
// mas exposto pra futuro uso. Mantemos por enquanto a impl original.

// ─── Bind: teclas globais ───
// USA capture phase pra receber antes de outros handlers
// e preventDefault sempre que possível pra impedir o navegador de interceptar
function _handleFeatureKeys(e){
  // Teclas funcionais e atalhos: funcionam mesmo com foco em input/select
  // F1 → ajuda (substitui F1 do navegador)
  if(e.key==='F1'){e.preventDefault();e.stopPropagation();showHelpModal();return true;}
  // F2 snapshot
  if(e.key==='F2'){e.preventDefault();e.stopPropagation();quickSnapshot();return true;}
  // F3 backups (navegador usa F3 pra "find next" — sobrescrevemos)
  if(e.key==='F3'){e.preventDefault();e.stopPropagation();showBackupsModal();return true;}
  // Atalhos sem foco em input
  const inEditing=e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable);
  if(inEditing)return false;
  // ? abre ajuda
  if(e.key==='?'||(e.shiftKey&&e.key==='/')){e.preventDefault();showHelpModal();return true;}
  // Esc fecha modais novos
  if(e.key==='Escape'){
    const h=document.getElementById('help-overlay');if(h&&h.classList.contains('show')){closeHelpModal();return true;}
    const b=document.getElementById('backups-overlay');if(b&&b.style.display==='flex'){closeBackupsModal();return true;}
    const s=document.getElementById('strong-clear-overlay');if(s&&s.classList.contains('show')){closeStrongClear();return true;}
    const a=document.getElementById('alerts-overlay');if(a&&a.classList.contains('show')){a.classList.remove('show');return true;}
    const cli=document.getElementById('cliente-overlay');if(cli&&cli.classList.contains('show')){closeClienteModal();return true;}
    const cliP=document.getElementById('clientes-panel-overlay');if(cliP&&cliP.classList.contains('show')){closeClientesPanel();return true;}
    if(document.body.classList.contains('print-mode')){togglePrintMode();return true;}
  }
  return false;
}
// Evita dupla execução quando o evento sobe window→document
function _featKeyOnce(e){
  if(e._featHandled)return;
  if(_handleFeatureKeys(e))e._featHandled=true;
}
// Registra em window E document (ambos capture) — pega o evento independente de onde foi disparado
window.addEventListener('keydown', _featKeyOnce, true);
document.addEventListener('keydown', _featKeyOnce, true);
// Body também (caso Leaflet bloqueie eventos antes)
document.body && document.body.addEventListener('keydown', _featKeyOnce, true);

// Recalcula alertas periodicamente — pausa quando a aba não está visível
// (poupa CPU; navegadores modernos já throttlam, mas dispensa o trabalho).
let _alertsTimer=null;
function _startAlertsTimer(){
  if(_alertsTimer)return;
  _alertsTimer=setInterval(()=>{if(!READONLY&&!document.hidden)checkAlerts();},15000);
}
function _stopAlertsTimer(){if(_alertsTimer){clearInterval(_alertsTimer);_alertsTimer=null;}}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)_stopAlertsTimer();else _startAlertsTimer();
});
_startAlertsTimer();
window.addEventListener('load',()=>{setTimeout(()=>{setupFileDrop();checkAlerts();},800);});

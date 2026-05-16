// ═══════════════════════════════════════════════
// modals.js — Modais de Propriedades, Alterar Cabo e Sub-Elementos
// ═══════════════════════════════════════════════

// Helper local de escape HTML (escH no fiber.js só existe dentro do popup)
function escH(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ═══════ MODAL DE PROPRIEDADES ═══════
function openEmModal(d){
  currentEM=d;
  document.getElementById('em-overlay').classList.add('show');
  const CFG={
    poste:{bg:'#1e3a5f',bd:'#3B82F6',tx:'#60A5FA'},cto:{bg:'#3d2a0a',bd:'#F59E0B',tx:'#FCD34D'},
    emenda:{bg:'#3d1212',bd:'#EF4444',tx:'#FCA5A5'},deriv:{bg:'#1a2433',bd:'#8B5CF6',tx:'#A78BFA'},
    cabo:{bg:'#1a2a1a',bd:d.color||'#1D9E75',tx:d.color||'#1D9E75'},olt:{bg:'#0a3a1a',bd:'#06B6D4',tx:'#06B6D4'},
    mpls:{bg:'#3a0a0a',bd:'#EF4444',tx:'#FCA5A5'},
    armario:{bg:'#2a1a2a',bd:'#EC4899',tx:'#EC4899'}
  };
  const c=CFG[d.tipo]||CFG.poste;
  const ic=document.getElementById('em-icon');
  ic.style.cssText=`background:${c.bg};border:2px solid ${c.bd};color:${c.tx}`;
  ic.textContent=d.tipo==='cabo'?'⌇':d.tipo==='olt'?'◇':d.tipo==='armario'?'◻':(d.nome||d.id).substring(0,2);
  document.getElementById('em-h2').textContent=d.nome||d.id;
  document.getElementById('em-sub').textContent=d.tipo.toUpperCase()+' · '+d.id+(d.tipo==='cabo'?` · ${d.total||d.grupos*d.fpg||'?'} FO`:'');
  const tabs=document.getElementById('em-tabs');
  const body=document.getElementById('em-body');
  const defs=buildEmTabs(d);
  tabs.innerHTML=defs.map((t,i)=>`<div class="em-tab${i===0?' act':''}" onclick="switchEmTab(${i})">${t.label}</div>`).join('');
  body.innerHTML=defs.map((t,i)=>`<div class="etc${i===0?' act':''}" id="etc-${i}">${t.html}</div>`).join('');
  // diagrama inline removido — use o botão 📊 Diagrama
}

function buildEmTabs(d){
  const tabs=[], near=d.tipo!=='cabo'?cablesNear(d):[];
  const isSub=(d.tipo==='olt'||d.tipo==='cto'||d.tipo==='emenda'||d.tipo==='deriv'||d.tipo==='mpls');
  let ph=`<div class="prs"><div class="prt">Identificação</div>
    <div class="prr"><span>ID</span><span class="pv">${d.id}</span></div>
    <div class="prr"><span>Nome</span><input class="pin" id="pi-nome" value="${d.nome||''}"></div>
    <div class="prr"><span>Obs.</span><input class="pin" id="pi-obs" value="${d.obs||''}"></div>`;

  if(d.tipo==='armario'){
    ph+=`<div class="prr"><span>Capacidade</span><input class="pin" id="pi-capacidade" type="number" value="${d.capacidade||24}"></div>
      <div class="prr"><span>Lat</span><span class="pv coord-copy" data-copy="${d.lat.toFixed(6)}" title="Click para copiar">${d.lat.toFixed(6)}</span></div><div class="prr"><span>Lng</span><span class="pv coord-copy" data-copy="${d.lng.toFixed(6)}" title="Click para copiar">${d.lng.toFixed(6)}</span></div><div class="prr"><span>Coords</span><span class="pv coord-copy" data-copy="${d.lat.toFixed(6)},${d.lng.toFixed(6)}" title="Click para copiar lat,lng" style="color:var(--green);cursor:pointer">📋 ${d.lat.toFixed(6)},${d.lng.toFixed(6)}</span></div>
      <div class="prr"><span>Google Maps</span><span class="pv"><a class="gmaps-link" href="https://www.google.com/maps?q=${d.lat},${d.lng}" target="_blank">Abrir no Maps ↗</a></span></div>`;
  }
  if(d.tipo==='poste'){
    ph+=`<div class="prr"><span>Nº</span><span class="pv">${d.num}</span></div><div class="prr"><span>Lat</span><span class="pv coord-copy" data-copy="${d.lat.toFixed(6)}" title="Click para copiar">${d.lat.toFixed(6)}</span></div><div class="prr"><span>Lng</span><span class="pv coord-copy" data-copy="${d.lng.toFixed(6)}" title="Click para copiar">${d.lng.toFixed(6)}</span></div><div class="prr"><span>Coords</span><span class="pv coord-copy" data-copy="${d.lat.toFixed(6)},${d.lng.toFixed(6)}" title="Click para copiar lat,lng" style="color:var(--green);cursor:pointer">📋 ${d.lat.toFixed(6)},${d.lng.toFixed(6)}</span></div>
      <div class="prr"><span>Google Maps</span><span class="pv"><a class="gmaps-link" href="https://www.google.com/maps?q=${d.lat},${d.lng}" target="_blank">Abrir no Maps ↗</a></span></div>`;
  }
  if(d.tipo==='olt'){
    ph+=`<div class="prr"><span>PONs</span><input class="pin" id="pi-portas" type="number" value="${d.portas||16}" title="Cada porta da OLT corresponde a uma saída PON"></div>`;
    if(d.parentId)ph+=`<div class="prr"><span>Armário pai</span><span class="pv" style="cursor:pointer;color:var(--magenta)" onclick="zoomTo('${d.parentId}');closeEmModal()">↗ ${findById(d.parentId)?.nome||d.parentId}</span></div>`;
    ph+=`<div class="prr"><span>Lat</span><span class="pv">${d.lat.toFixed(6)}</span></div>`;
  }
  if(d.tipo==='mpls'){
    ph+=`<div class="prr"><span>Fibras</span><input class="pin" id="pi-portas" type="number" min="1" max="10" value="${d.portas||4}" title="Quantidade de fibras de saída do MPLS (1 a 10)"></div>`;
    if(d.parentId)ph+=`<div class="prr"><span>Armário pai</span><span class="pv" style="cursor:pointer;color:var(--magenta)" onclick="zoomTo('${d.parentId}');closeEmModal()">↗ ${findById(d.parentId)?.nome||d.parentId}</span></div>`;
  }
  if(d.tipo==='cto'){
    ph+=`<div class="prr"><span>Portas</span><input class="pin" id="pi-portas" type="number" value="${d.portas||8}"></div>`;
    if(d.splitter)ph+=`<div class="prr"><span>Splitter</span><span class="pv amber">${d.splitter}</span></div>`;
    if(d.parentId)ph+=`<div class="prr"><span>Poste pai</span><span class="pv" style="cursor:pointer;color:var(--blue)" onclick="zoomTo('${d.parentId}');closeEmModal()">↗ ${findById(d.parentId)?.nome||d.parentId}</span></div>`;
  }
  if(d.tipo==='emenda'){
    ph+=`<div class="prr"><span>Bandejas</span><input class="pin" id="pi-bandejas" type="number" value="${d.bandejas||12}"></div>`;
  }
  if(d.tipo==='deriv'){
    ph+=`<div class="prr"><span>Capacidade</span><input class="pin" id="pi-cap" type="number" value="${d.capacidade||8}"></div>`;
    if(d.splitter)ph+=`<div class="prr"><span>Splitter</span><span class="pv amber">${d.splitter}</span></div>`;
    if(d.parentId)ph+=`<div class="prr"><span>Poste pai</span><span class="pv" style="cursor:pointer;color:var(--blue)" onclick="zoomTo('${d.parentId}');closeEmModal()">↗ ${findById(d.parentId)?.nome||d.parentId}</span></div>`;
  }
  if(d.tipo==='cabo'){
    const ESTILO={conv:'Convencional',fig8:'Figura 8',adss:'ADSS',drop:'Drop Indoor',blind:'Blindado',diel:'Dielétrico'};
    ph+=`<div class="prr"><span>Tipo</span><span class="pv">${d.typeName||d.typeId||'—'}</span></div>
      <div class="prr"><span>Estrutura</span><span class="pv">${d.grupos||1} tubos × ${d.fpg||12} FO = ${d.total||d.grupos*d.fpg} FO</span></div>
      <div class="prr"><span>Estilo</span><span class="pv">${ESTILO[d.estilo]||d.estilo||'—'}</span></div>
      <div class="prr"><span>Comprimento</span><span class="pv green">${d.dist>=1000?(d.dist/1000).toFixed(3)+' km':d.dist+' m'}</span></div>
      <div class="prr"><span>Âncoras</span><span class="pv">${(d.anchors||[]).map(aid=>findById(aid)?.nome||aid).join(', ')||'nenhum'}</span></div>`;
  }
  ph+=`</div>`;

  if(d.tipo==='armario'){
    const children=(d.children||[]);
    const childElems=children.map(c=>findById(c.id)).filter(Boolean);
    const COL_SUB={olt:'#06B6D4',mpls:'#EF4444'};
    const LBL_SUB={olt:'OLT',mpls:'MPLS'};
    ph+=`<div class="prs"><div class="prt">Elementos vinculados (${childElems.length})</div>`;
    if(childElems.length){
      childElems.forEach(c=>{
        const cc=COL_SUB[c.tipo]||'#888';
        const ll=LBL_SUB[c.tipo]||c.tipo.toUpperCase();
        ph+=`<div class="prr" style="cursor:pointer" onclick="closeEmModal();setTimeout(()=>openEmModal(findById('${c.id}')),50)">
          <span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${cc};flex-shrink:0;display:inline-block"></span><span class="pv" style="color:${cc}">${c.nome||c.id}</span><span style="color:var(--text3);font-size:10px">${ll}</span></span><span style="color:var(--text3);font-size:10px">→ abrir</span>
        </div>`;
      });
    }else{ph+=`<div style="color:var(--text3);font-size:11px;font-family:var(--mono);padding:4px 0">Nenhum elemento vinculado.</div>`;}
    ph+=`</div><div class="prs"><div class="prt">Adicionar ao armário</div><div class="qag">
      <div class="qab" onclick="quickAdd('olt',currentEM)"><div class="qai" style="background:#0a3a1a;border:2px solid #06B6D4;color:#06B6D4">OLT</div><span class="qal">Nova OLT</span></div>
      <div class="qab" onclick="quickAdd('mpls',currentEM)"><div class="qai" style="background:#3a0a0a;border:2px solid #EF4444;color:#FCA5A5">MPLS</div><span class="qal">Novo MPLS</span></div>
    </div></div>`;
  }
  if(d.tipo==='poste'){
    const children=(d.children||[]);
    const childElems=children.map(c=>findById(c.id)).filter(Boolean);
    ph+=`<div class="prs"><div class="prt">Elementos vinculados (${childElems.length})</div>`;
    if(childElems.length){
      childElems.forEach(c=>{
        const COL={cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6'};
        const lbl={cto:'CTO',emenda:'Emenda',deriv:'Derivação'};
        const sp=c.splitter?` <span style="color:var(--amber);font-size:9px">${c.splitter}</span>`:'';
        ph+=`<div class="prr" style="cursor:pointer" onclick="closeEmModal();setTimeout(()=>openEmModal(findById('${c.id}')),50)">
          <span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${COL[c.tipo]||'#888'};flex-shrink:0;display:inline-block"></span><span class="pv" style="color:${COL[c.tipo]||'#888'}">${c.nome||c.id}</span><span style="color:var(--text3);font-size:10px">${lbl[c.tipo]||c.tipo}</span>${sp}</span><span style="color:var(--text3);font-size:10px">→ abrir</span>
        </div>`;
      });
    }else{ph+=`<div style="color:var(--text3);font-size:11px;font-family:var(--mono);padding:4px 0">Nenhum elemento vinculado ainda.</div>`;}
    const jaTemEmenda=(d.children||[]).some(c=>c.tipo==='emenda');
    const emendaBtn=jaTemEmenda
      ? `<div class="qab" style="opacity:.35;cursor:not-allowed;filter:grayscale(.8)" title="Este ${d.tipo} já possui uma emenda vinculada"><div class="qai" style="background:#2a2a2a;border:2px solid #555;color:#888">E</div><span class="qal" style="color:var(--text3)">Nova Emenda</span></div>`
      : `<div class="qab" onclick="quickAdd('emenda',currentEM)"><div class="qai" style="background:#3d1212;border:2px solid #EF4444;color:#FCA5A5">E</div><span class="qal">Nova Emenda</span></div>`;
    ph+=`</div>
    <div class="prs"><div class="prt">Adicionar elemento vinculado</div><div class="qag">
      <div class="qab" onclick="quickAdd('cto',currentEM)"><div class="qai" style="background:#3d2a0a;border:2px solid #F59E0B;color:#FCD34D">CTO</div><span class="qal">Nova CTO</span></div>
      ${emendaBtn}
      <div class="qab" onclick="quickAdd('deriv',currentEM)"><div class="qai" style="background:#1a2433;border:2px solid #8B5CF6;color:#A78BFA">⑂</div><span class="qal">Derivação</span></div>
    </div></div>`;
    const hasEmendaDiag=(d.children||[]).some(c=>c.tipo==='emenda');
    ph+=`<div class="pact"><button class="pab gn" onclick="saveProps()">✓ Salvar</button><button class="pab rd" onclick="askRemove(currentEM);closeEmModal()">✕ Remover</button>${hasEmendaDiag?`<button class="pab gn" onclick="openDiagramInNewTab('${d.id}')" style="margin-left:auto">📊 Diagrama</button>`:`<button class="pab gn" disabled style="margin-left:auto;opacity:.35;cursor:not-allowed" title="Adicione uma Emenda óptica primeiro">📊 Diagrama</button>`}</div>`;
  } else if(d.tipo === 'cabo') {
    // Botões para cabos
    ph += `<div class="pact" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="pab gn" onclick="saveProps()">✓ Salvar</button>
            <button class="pab rd" onclick="askRemove(currentEM);closeEmModal()">✕ Remover</button>
            <button class="pab gn" onclick="showCablePath(currentEM)" title="Animar caminho do cabo do início ao fim">▶ Mostrar caminho</button>
            <button class="pab gn" onclick="editCableAnchoring(currentEM)" title="Mover âncoras para outros postes/armários">⚓ Editar ancoragem</button>
            <button class="pab gn" onclick="generateCableReport(currentEM)" title="Gerar relatório PDF deste cabo">📄 PDF</button>
        </div>
        <button class="pab gn" onclick="openAlterarCaboModal(currentEM)">✏️ Alterar</button>
    </div>`;
  } else if(d.tipo==='armario'){
    ph+=`<div class="pact"><button class="pab gn" onclick="saveProps()">✓ Salvar</button><button class="pab rd" onclick="askRemove(currentEM);closeEmModal()">✕ Remover</button><button class="pab gn" onclick="openDiagramInNewTab('${d.id}')" style="margin-left:auto">📊 Diagrama</button></div>`;
  } else {
    const parentBtn=d.parentId&&findById(d.parentId)
      ? `<button class="pab gn" onclick="openEmModal(findById('${d.parentId}'))" style="margin-left:auto" title="Voltar ao elemento pai">↩ Voltar</button>`
      : '';
    ph+=`<div class="pact"><button class="pab gn" onclick="saveProps()">✓ Salvar</button><button class="pab rd" onclick="askRemove(currentEM);closeEmModal()">✕ Remover</button>${parentBtn}</div>`;
  }
  tabs.push({label:'Propriedades',html:ph});

  if(isSub) return tabs;

  let ch='';
  if(d.tipo==='cabo'){
    const att=calcAtt(d);
    ch=`<div class="ac"><div class="ac-t">${d.nome||d.id} — ${d.typeName||''}</div>
      <div class="ar"><span>Estrutura</span><span>${d.grupos||1}T × ${d.fpg||12}FO = ${d.total}FO</span></div>
      <div class="ar"><span>Comprimento</span><span>${d.dist>=1000?(d.dist/1000).toFixed(3)+' km':d.dist+' m'}</span></div>
      <div class="ar"><span>Att. fibra</span><span>${att.af.toFixed(2)} dB</span></div><div class="ar"><span>Emendas ×${att.ec}</span><span>${(att.ec*ATT.emenda).toFixed(2)} dB</span></div>
      ${att.splitterLoss>0?`<div class="ar"><span>Splitters</span><span>${att.splitterLoss.toFixed(1)} dB</span></div>`:''}
      <div class="ar"><span>Conectores</span><span>${(ATT.conector*2).toFixed(1)} dB</span></div>
      <div class="ar"><span>Total</span><span style="font-weight:600">${att.tot.toFixed(2)} dB / ${ATT.budget} dB</span></div>
      ${att.margin>=5?`<span class="ab ok">OK — ${att.margin.toFixed(1)} dB margem</span>`:att.margin>=0?`<span class="ab wn">Limite — ${att.margin.toFixed(1)} dB</span>`:`<span class="ab bd">EXCEDE ${Math.abs(att.margin).toFixed(1)} dB</span>`}
    </div>`;
  }else if(!near.length){
    ch='<div style="color:var(--text3);font-size:12px;font-family:var(--mono)">Nenhum cabo detectado nas proximidades.</div>';
  }else{
    near.forEach(c=>{
      const label=cableLabel(d,c), att=calcAtt(c), dir=cableDir(d,c);
      ch+=`<div class="ci ci-clickable" onclick="closeEmModal();setTimeout(()=>{const c=findById('${c.id}');if(c){zoomTo('${c.id}');openEmModal(c);}},50)" title="Abrir propriedades do cabo"><div class="eid" style="background:${c.color}"></div><div class="ci-info"><div class="ci-name">${label}</div><div class="ci-meta">${c.typeName||c.typeId||''} · ${c.total||'?'} FO · ${c.dist>=1000?(c.dist/1000).toFixed(2)+' km':c.dist+' m'} · ${att.tot.toFixed(1)} dB</div></div><span class="ci-dir ${dir==='entrada'?'ci-in':dir==='saída'?'ci-out':'ci-mid'}">${dir}</span><span class="ci-arrow">→</span></div>`;
    });
  }
  tabs.push({label:'Cabos',html:ch});

  let ah='';
  const attSrc=d.tipo==='cabo'?[d]:near;
  if(!attSrc.length){ah='<div style="color:var(--text3);font-size:12px;font-family:var(--mono)">Nenhum dado de atenuação disponível.</div>';}
  else attSrc.forEach(c=>{
    const att=calcAtt(c);
    ah+=`<div class="ac"><div class="ac-t">${c.nome||c.id}</div>
      <div class="ar"><span>Distância</span><span>${c.dist>=1000?(c.dist/1000).toFixed(3)+' km':c.dist+' m'}</span></div>
      <div class="ar"><span>Att. fibra (${ATT.fibra} dB/km)</span><span>${att.af.toFixed(2)} dB</span></div>
      <div class="ar"><span>Emendas CEO (×${att.ec})</span><span>${(att.ec*ATT.emenda).toFixed(2)} dB</span></div>
      ${att.splitterLoss>0?`<div class="ar"><span>Splitters</span><span>${att.splitterLoss.toFixed(1)} dB</span></div>`:''}
      <div class="ar"><span>Conectores (×2)</span><span>${(ATT.conector*2).toFixed(1)} dB</span></div>
      <div class="ar"><span>Total</span><span style="font-weight:600">${att.tot.toFixed(2)} dB</span></div>
      <div class="ar"><span>Budget</span><span>${ATT.budget} dB</span></div>
      ${att.margin>=5?`<span class="ab ok">OK — ${att.margin.toFixed(1)} dB</span>`:att.margin>=0?`<span class="ab wn">Limite — ${att.margin.toFixed(1)} dB</span>`:`<span class="ab bd">EXCEDE ${Math.abs(att.margin).toFixed(1)} dB</span>`}
    </div>`;
  });
  tabs.push({label:'Atenuação',html:ah});

  // ═══ Aba FIBRAS (apenas para cabos) — reformulada com visual dinâmico ═══
  if(d.tipo==='cabo'){
    const grupos=d.grupos||1, fpg=d.fpg||12, total=d.total||(grupos*fpg);
    // Pré-computa origem (OLT/MPLS) e contadores
    const findSrc=(typeof findSourceForFiber==='function')?findSourceForFiber:null;
    const sourcePerFi=[];
    let connCount=0, mplsCount=0;
    for(let i=0;i<total;i++){
      const src=findSrc?findSrc(d.id,i):null;
      sourcePerFi.push(src);
      if(src){connCount++;if(src.tipo==='mpls')mplsCount++;}
    }
    const freeCount=total-connCount;
    const pct=total?Math.round(100*connCount/total):0;
    const pctColor=pct>=90?'#EF4444':pct>=70?'#F59E0B':pct>0?'#10B981':'#94a3b8';

    let fh=`<div class="fibers-tab-v2">
      <!-- Cards de resumo -->
      <div class="ft-summary">
        <div class="ft-card">
          <div class="ft-card-num" style="color:#3b82f6">${total}</div>
          <div class="ft-card-lbl">Fibras totais</div>
        </div>
        <div class="ft-card">
          <div class="ft-card-num" style="color:#10b981">${connCount}</div>
          <div class="ft-card-lbl">Conectadas</div>
        </div>
        <div class="ft-card">
          <div class="ft-card-num" style="color:#94a3b8">${freeCount}</div>
          <div class="ft-card-lbl">Livres</div>
        </div>
        <div class="ft-card">
          <div class="ft-card-num" style="color:${pctColor}">${pct}%</div>
          <div class="ft-card-lbl">Ocupação</div>
        </div>
      </div>
      <!-- Barra visual de ocupação -->
      <div class="ft-bar" title="${connCount} de ${total} conectadas">
        <div class="ft-bar-fill" style="width:${pct}%;background:${pctColor}"></div>
      </div>
      <!-- Filtros -->
      <div class="ft-filters">
        <button class="ft-fbtn act" data-filter="all" onclick="filterFiberRows('${d.id}','all',this)">Todas (${total})</button>
        <button class="ft-fbtn" data-filter="connected" onclick="filterFiberRows('${d.id}','connected',this)">✓ Conectadas (${connCount})</button>
        <button class="ft-fbtn" data-filter="free" onclick="filterFiberRows('${d.id}','free',this)">○ Livres (${freeCount})</button>
        ${mplsCount>0?`<button class="ft-fbtn" data-filter="mpls" onclick="filterFiberRows('${d.id}','mpls',this)" style="color:#EF4444">▣ MPLS (${mplsCount})</button>`:''}
      </div>
      <!-- Lista agrupada por tubo -->
      <div class="ft-list-v2" id="ft-list-${d.id}">`;

    for(let g=0;g<grupos;g++){
      const tc=ABNT[g%12];
      const tBright=(parseInt(tc.hex.slice(1,3),16)*299+parseInt(tc.hex.slice(3,5),16)*587+parseInt(tc.hex.slice(5,7),16)*114)/1000;
      const tTextColor=tBright>160?'#000':'#fff';
      // Header do tubo (só mostra se houver mais de 1 tubo)
      if(grupos>1){
        // Conta conectadas neste tubo
        let tubeConn=0;
        for(let f=0;f<fpg;f++){if(sourcePerFi[g*fpg+f])tubeConn++;}
        fh+=`<div class="ft-tube-hdr" style="background:${tc.hex};color:${tTextColor}">
          <span class="ft-tube-name">TUBO ${g+1} · ${tc.name.toUpperCase()}</span>
          <span class="ft-tube-stat">${tubeConn}/${fpg}</span>
        </div>`;
      }
      // Fibras do tubo
      for(let f=0;f<fpg;f++){
        const fi=g*fpg+f;
        const a=abntColor(fi,fpg);
        const src=sourcePerFi[fi];
        const fBright=(parseInt(a.fiber.hex.slice(1,3),16)*299+parseInt(a.fiber.hex.slice(3,5),16)*587+parseInt(a.fiber.hex.slice(5,7),16)*114)/1000;
        const fTextColor=fBright>160?'#000':'#fff';
        // Status badge
        let statusBadge, sourceBadge;
        if(src){
          if(src.tipo==='mpls'){
            statusBadge=`<span class="ft-status ft-st-mpls">● MPLS</span>`;
            sourceBadge=`<span class="ft-src-mpls" title="Conectada ao MPLS ${escH(src.nome)}">▣ MPLS <b>${escH(src.nome)}</b></span>`;
          }else{
            statusBadge=`<span class="ft-status ft-st-conn">● Conectada</span>`;
            sourceBadge=`<span class="ft-src-olt" title="Sinal vem da OLT ${escH(src.nome)} · PON ${src.pon}">📡 OLT <b>${escH(src.nome)}</b> · PON <b>${src.pon}</b></span>`;
          }
        }else{
          statusBadge=`<span class="ft-status ft-st-free">○ Livre</span>`;
          sourceBadge=`<span class="ft-src-free">— Disponível pra conectar</span>`;
        }
        const dataAttr=src?(src.tipo==='mpls'?'mpls':'connected'):'free';
        fh+=`<div class="ft-row-v2" data-fi="${fi}" data-status="${dataAttr}" onclick="selectFiberRow(this,'${d.id}',${fi})">
          <div class="ft-fi-num">${fi+1}</div>
          <div class="ft-fhex" style="background:${a.fiber.hex};color:${fTextColor};border:2px solid ${a.tube.hex}">${a.fiberN}</div>
          <div class="ft-fcolor">
            <div class="ft-fcolor-name">${a.fiber.name}</div>
            ${grupos>1?`<div class="ft-fcolor-sub">T${a.tubeN}·F${a.fiberN}</div>`:''}
          </div>
          <div class="ft-fstatus">${statusBadge}</div>
          <div class="ft-fsource">${sourceBadge}</div>
        </div>`;
      }
    }

    fh+=`</div>
      <!-- Ação ao selecionar -->
      <div class="ft-actions-v2" id="ft-actions-${d.id}" style="display:none">
        <button class="pab gn" onclick="onShowSelectedFiberPath('${d.id}')">▸ Ver caminho completo da fibra selecionada</button>
      </div>
    </div>`;
    tabs.push({label:'Fibras',html:fh});
  }

  return tabs;
}

var _selectedFiberRow={cabId:null,fi:null};
function selectFiberRow(rowEl,cabId,fi){
  // Limpa seleção anterior em ambas as variantes da lista (v1 e v2)
  var list=document.getElementById('ft-list-'+cabId);
  if(list){list.querySelectorAll('.ft-row,.ft-row-v2').forEach(function(r){r.classList.remove('sel');});}
  rowEl.classList.add('sel');
  _selectedFiberRow={cabId:cabId,fi:fi};
  var act=document.getElementById('ft-actions-'+cabId);
  if(act)act.style.display='flex';
}
// Filtra fibras na aba Fibras V2 por status (all/connected/free/mpls)
function filterFiberRows(cabId,mode,btnEl){
  var list=document.getElementById('ft-list-'+cabId);
  if(!list)return;
  // Atualiza botões
  var filtBar=btnEl?btnEl.parentElement:null;
  if(filtBar)filtBar.querySelectorAll('.ft-fbtn').forEach(function(b){b.classList.toggle('act',b===btnEl);});
  // Aplica filtro nas linhas
  var rows=list.querySelectorAll('.ft-row-v2');
  rows.forEach(function(r){
    var st=r.getAttribute('data-status');
    var show=(mode==='all')||(mode==='connected'&&(st==='connected'||st==='mpls'))||(mode==='free'&&st==='free')||(mode==='mpls'&&st==='mpls');
    r.style.display=show?'':'none';
  });
  // Esconde headers de tubo cujas fibras estão todas escondidas
  var headers=list.querySelectorAll('.ft-tube-hdr');
  headers.forEach(function(h){
    var anyVisible=false;
    var next=h.nextElementSibling;
    while(next&&!next.classList.contains('ft-tube-hdr')){
      if(next.classList.contains('ft-row-v2')&&next.style.display!=='none'){anyVisible=true;break;}
      next=next.nextElementSibling;
    }
    h.style.display=anyVisible?'':'none';
  });
}
function onShowSelectedFiberPath(cabId){
  if(_selectedFiberRow.cabId!==cabId||_selectedFiberRow.fi==null){
    showToast('Selecione uma fibra na lista primeiro','warning');return;
  }
  showCableFiberPathModal(cabId,_selectedFiberRow.fi);
}

function switchEmTab(i){
  document.querySelectorAll('.em-tab').forEach((t,j)=>t.classList.toggle('act',i===j));
  document.querySelectorAll('.etc').forEach((t,j)=>t.classList.toggle('act',i===j));
  // diagrama inline removido
}
function closeEmModal(){ document.getElementById('em-overlay').classList.remove('show'); currentEM=null; }

function saveProps(){
  const d=currentEM; if(!d)return;
  const n=document.getElementById('pi-nome'); if(n)d.nome=n.value;
  const o=document.getElementById('pi-obs'); if(o)d.obs=o.value;
  if(d.tipo==='armario'){const e=document.getElementById('pi-capacidade');if(e)d.capacidade=parseInt(e.value)||24;}
  if(d.tipo==='olt'){const e=document.getElementById('pi-portas');if(e)d.portas=parseInt(e.value)||16;}
  if(d.tipo==='mpls'){const e=document.getElementById('pi-portas');if(e){let v=parseInt(e.value)||4;d.portas=Math.max(1,Math.min(10,v));}}
  if(d.tipo==='cto'){const e=document.getElementById('pi-portas');if(e)d.portas=parseInt(e.value)||8;}
  if(d.tipo==='emenda'){const e=document.getElementById('pi-bandejas');if(e)d.bandejas=parseInt(e.value)||12;}
  if(d.tipo==='deriv'){const e=document.getElementById('pi-cap');if(e)d.capacidade=parseInt(e.value)||8;}
  document.getElementById('em-h2').textContent=d.nome||d.id;
  if(d.tipo==='poste')refreshPosteIcon(d);
  if(d.tipo==='armario')refreshArmarioIcon(d);
  bindPosteTooltip(d);
  debouncedUpdList();scheduleAutosave();
  stateManager.pushState(`Editar ${d.nome||d.id}`);
  const btn=event.target; btn.textContent='✓ Salvo!'; setTimeout(()=>btn.textContent='✓ Salvar',1500);
}

// ═══════ ALTERAR CABO ═══════
let _caboParaAlterar = null;

function openAlterarCaboModal(d) {
  _caboParaAlterar = d;
  closeEmModal();

  document.getElementById('alterar-cm-id').value = d.nome || d.id;
  document.getElementById('alterar-cm-color').value = d.color;

  const grid = document.getElementById('alterar-cable-type-grid');
  grid.innerHTML = CABLE_TYPES.map(ct => `
    <div class="ctb" data-id="${ct.id}" onclick="selectAlterarCableType('${ct.id}')">
      <div class="ctb-name" style="color:${ct.color}">${ct.name}</div>
      <div class="ctb-desc">${ct.desc}</div>
    </div>`).join('');

  const currentTypeId = d.typeId || 'fo-12';
  document.querySelectorAll('#alterar-cable-type-grid .ctb').forEach(b => {
    b.classList.toggle('sel', b.dataset.id === currentTypeId);
  });

  renderRecentColors('alterar-cm-recent-colors','alterar-cm-color');
  document.getElementById('alterar-cabo-overlay').style.display = 'flex';
}

function selectAlterarCableType(id) {
  document.querySelectorAll('#alterar-cable-type-grid .ctb').forEach(b => {
    b.classList.toggle('sel', b.dataset.id === id);
  });
}

function closeAlterarCaboModal() {
  document.getElementById('alterar-cabo-overlay').style.display = 'none';
  _caboParaAlterar = null;
  if(currentEM) openEmModal(currentEM);
}

function confirmAlterarCabo() {
  if(!_caboParaAlterar) return;
  const d = _caboParaAlterar;

  const novoNome = document.getElementById('alterar-cm-id').value.trim();
  const novaCor = document.getElementById('alterar-cm-color').value;

  const selected = document.querySelector('#alterar-cable-type-grid .ctb.sel');
  let typeId = selected ? selected.dataset.id : 'fo-12';
  const ct = CABLE_TYPES.find(c => c.id === typeId) || CABLE_TYPES[1];

  saveRecentColor(novaCor);
  d.nome = novoNome || d.id;
  d.color = novaCor;
  d.typeId = typeId;
  d.typeName = ct.name;
  d.grupos = ct.grupos;
  d.fpg = ct.fpg;
  d.total = ct.grupos * ct.fpg;
  d.estilo = ct.estilo;

  // Remove diagrama de fibras e conexões do cabo
  d.fibers = { connections:[], splitters:[], diagramPositions:{} };

  if(d.poly) {
    d.poly.setStyle({ color: novaCor });
  }

  updCableLegend();
  closeAlterarCaboModal();
  document.getElementById('alterar-cabo-overlay').style.display = 'none';
  _caboParaAlterar = null;

  showToast('✓ Cabo alterado com sucesso', 'success');
  scheduleAutosave();
  stateManager.pushState(`Alterar ${d.nome || d.id}`);
}
// ═══════ QUICK ADD & SUB-ELEMENT ═══════
function quickAdd(tipo, parentElem){
  if(tipo==='olt'||tipo==='mpls'){ openSubElemModal(tipo,parentElem); return; }
  if((tipo==='cto'||tipo==='deriv') && parentElem.tipo==='poste'){
    const hasEmenda = (parentElem.children||[]).some(c=>c.tipo==='emenda');
    if(!hasEmenda){
      closeEmModal();
      _lastParentForEmendaWarning = parentElem;
      document.getElementById('emenda-warning-overlay').style.display='flex';
      return;
    }
  }
  if(tipo==='emenda'){
    const jaTemEmenda=(parentElem.children||[]).some(c=>c.tipo==='emenda');
    if(jaTemEmenda){
      showToast(`Este ${parentElem.tipo} já possui uma emenda vinculada`,'warning');
      return;
    }
    const nd=addSubElement('emenda',parentElem);
    map.setView([nd.lat,nd.lng],18);
    showToast(`Emenda ${nd.nome||nd.id} criada.`);
    if(currentEM && currentEM.id===parentElem.id) openEmModal(parentElem);
    return;
  }
  openSubElemModal(tipo,parentElem);
}

document.getElementById('btn-emenda-warning-ok').addEventListener('click',()=>{
  document.getElementById('emenda-warning-overlay').style.display='none';
  if(_lastParentForEmendaWarning){ openEmModal(_lastParentForEmendaWarning); _lastParentForEmendaWarning=null; }
});

function openSubElemModal(tipo,parentElem){
  _subPending={tipo,parent:parentElem};
  const isOLT=tipo==='olt', isCTO=tipo==='cto', isMPLS=tipo==='mpls';
  const titles={olt:'Nova OLT vinculada',cto:'Nova CTO vinculada',mpls:'Novo MPLS vinculado',deriv:'Nova Derivação vinculada'};
  document.getElementById('sub-modal-title').textContent=titles[tipo]||'Novo elemento vinculado';
  document.getElementById('sub-parent-info').textContent=`Vinculado a: ${parentElem.nome||parentElem.id}`;
  const colors={olt:{c:'#06B6D4',bg:'#0a3a1a',ic:'OLT'},cto:{c:'#F59E0B',bg:'#3d2a0a',ic:'CTO'},mpls:{c:'#EF4444',bg:'#3a0a0a',ic:'MPLS'},deriv:{c:'#8B5CF6',bg:'#1a2433',ic:'⑂'}};
  const cf=colors[tipo]||colors.deriv;
  const ic=document.getElementById('sub-icon');
  ic.style.cssText=`background:${cf.bg};border:2px solid ${cf.c};color:${cf.c};width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--mono);flex-shrink:0`;
  ic.textContent=cf.ic;
  document.getElementById('sub-nome').value='';
  document.getElementById('sub-obs').value='';
  document.getElementById('sub-spec-input').value=isOLT?'16':isMPLS?'4':'8';
  const specLbl={olt:'PONs',cto:'Portas',mpls:'Fibras (1-10)',deriv:'Capacidade'};
  document.getElementById('sub-spec-label').textContent=specLbl[tipo]||'Capacidade';
  // MPLS e OLT não usam splitter
  const splitRow=document.getElementById('sub-split-row');
  splitRow.style.display=(isOLT||isMPLS)?'none':'block';
  if(!isOLT&&!isMPLS){
    document.getElementById('sub-split-1-8').classList.add('sel');
    document.getElementById('sub-split-1-16').classList.remove('sel');
    document.getElementById('sub-split-none').classList.remove('sel');
  }
  closeEmModal();
  document.getElementById('sub-overlay').style.display='flex';
}

function selectSubSplit(val){
  const idMap={'1/8':'sub-split-1-8','1/16':'sub-split-1-16','none':'sub-split-none'};
  Object.keys(idMap).forEach(v=>{
    const el=document.getElementById(idMap[v]);
    if(el) el.classList.toggle('sel', v===val);
  });
  const specInput=document.getElementById('sub-spec-input');
  if(!specInput) return;
  if(val==='1/16') specInput.value=16;
  else if(val==='1/8') specInput.value=8;
}

function confirmSubModal(){
  const tipo=_subPending.tipo, parent=_subPending.parent;
  if(!tipo||!parent) return;
  const nome=document.getElementById('sub-nome').value.trim();
  const obs=document.getElementById('sub-obs').value.trim();
  let spec=parseInt(document.getElementById('sub-spec-input').value)||(tipo==='olt'?16:tipo==='mpls'?4:8);
  // MPLS: clamp 1-10
  if(tipo==='mpls')spec=Math.max(1,Math.min(10,spec));
  let splitterRatio=null;
  if(tipo!=='olt'&&tipo!=='mpls'){
    if(document.getElementById('sub-split-1-8').classList.contains('sel')) splitterRatio='1/8';
    else if(document.getElementById('sub-split-1-16').classList.contains('sel')) splitterRatio='1/16';
  }
  const nd=addSubElement(tipo,parent,{nome:nome||undefined,obs:obs||undefined,portas:spec,capacidade:spec,splitter:splitterRatio});
  closeSubModal();
  map.setView([nd.lat,nd.lng],18);
  debouncedUpdList();
  openEmModal(parent);
}

function closeSubModal(){
  document.getElementById('sub-overlay').style.display='none';
  const parent=_subPending.parent;
  _subPending={tipo:null,parent:null};
  if(parent && !currentEM) openEmModal(parent);
  else if(parent && currentEM && currentEM.id!==parent.id) openEmModal(parent);
}


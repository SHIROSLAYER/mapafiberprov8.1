// ═══════════════════════════════════════════════
// clients.js — Modelo e UI de Clientes/ONUs vinculados a CTO/Deriv
// ═══════════════════════════════════════════════
//
// Cada CTO ou Derivação ganha um array `clientes`, onde cada cliente é:
//   { id, porta, nome, endereco, telefone, plano, onuSerial, obs, ativo }
//
// Vinculação:  cliente.porta === índice da porta (out:CTO.id, fi=porta)
// Uma porta pode ter no máximo um cliente ativo.
// ═══════════════════════════════════════════════

let _clientCnt = 0;

function nextClientId(){
  _clientCnt++;
  return 'CL'+String(_clientCnt).padStart(4,'0');
}

function getClientesOf(parent){
  if(!parent.clientes)parent.clientes=[];
  return parent.clientes;
}

function getClienteOnPort(parent, portaIdx){
  return (parent.clientes||[]).find(c=>c.porta===portaIdx&&c.ativo!==false);
}

function listAllClientes(){
  const out=[];
  [].concat(ctos||[],derivs||[]).forEach(parent=>{
    (parent.clientes||[]).forEach(c=>out.push({...c,parent}));
  });
  return out;
}

// ═══ Modal de cliente ═══
let _clientCtx = null; // {parent, porta, cliente?}
function openClienteModal(parent, porta, cliente){
  _clientCtx = {parent, porta, cliente:cliente||null};
  let ov = document.getElementById('cliente-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'cliente-overlay';
    ov.className = 'cliente-overlay';
    ov.addEventListener('click', e=>{if(e.target===ov)closeClienteModal();});
    document.body.appendChild(ov);
  }
  const c = cliente || {};
  const portaLbl = parent.tipo==='cto'?'Porta '+(porta+1):'Saída '+(porta+1);
  const parentLbl = (parent.tipo==='cto'?'CTO ':'Deriv ')+(parent.nome||parent.id);
  ov.innerHTML = `
    <div class="cli-modal">
      <div class="cli-hdr">
        <div>
          <h2>${cliente?'✏️ Editar Cliente':'➕ Novo Cliente'}</h2>
          <p>${escH(parentLbl)} · ${escH(portaLbl)}</p>
        </div>
        <button class="cc-close" onclick="closeClienteModal()">✕</button>
      </div>
      <div class="cli-body">
        <div class="cli-row">
          <label>Nome do cliente *</label>
          <input class="cm-input" id="cli-nome" placeholder="Ex: João Silva" value="${escAttr(c.nome||'')}">
        </div>
        <div class="cli-row">
          <label>Endereço</label>
          <input class="cm-input" id="cli-endereco" placeholder="Rua, número, bairro" value="${escAttr(c.endereco||'')}">
        </div>
        <div class="cli-grid">
          <div class="cli-row">
            <label>Telefone</label>
            <input class="cm-input" id="cli-telefone" placeholder="(00) 00000-0000" value="${escAttr(c.telefone||'')}">
          </div>
          <div class="cli-row">
            <label>Plano</label>
            <input class="cm-input" id="cli-plano" placeholder="Ex: 500 MB" value="${escAttr(c.plano||'')}">
          </div>
        </div>
        <div class="cli-grid">
          <div class="cli-row">
            <label>ONU / Serial</label>
            <input class="cm-input" id="cli-onu" placeholder="HWTC12345678" value="${escAttr(c.onuSerial||'')}">
          </div>
          <div class="cli-row">
            <label>Status</label>
            <select class="cm-input" id="cli-ativo">
              <option value="true" ${c.ativo!==false?'selected':''}>✓ Ativo</option>
              <option value="false" ${c.ativo===false?'selected':''}>○ Inativo</option>
            </select>
          </div>
        </div>
        <div class="cli-row">
          <label>Observações</label>
          <textarea class="cm-input" id="cli-obs" rows="2" placeholder="Notas internas">${escH(c.obs||'')}</textarea>
        </div>
      </div>
      <div class="cli-footer">
        ${cliente?`<button class="cm-btn danger" onclick="deleteCliente()" style="margin-right:auto">✕ Remover cliente</button>`:''}
        <button class="cm-btn" onclick="closeClienteModal()">Cancelar</button>
        <button class="cm-btn primary" onclick="saveCliente()">${cliente?'✓ Salvar':'✓ Criar'}</button>
      </div>
    </div>`;
  ov.classList.add('show');
  setTimeout(()=>{const i=document.getElementById('cli-nome');if(i)i.focus();},50);
}

function closeClienteModal(){
  const ov=document.getElementById('cliente-overlay');if(ov)ov.classList.remove('show');
  _clientCtx=null;
}

function saveCliente(){
  if(!_clientCtx)return;
  const {parent, porta, cliente} = _clientCtx;
  const nome=document.getElementById('cli-nome').value.trim();
  if(!nome){showToast('Nome obrigatório','warning');return;}
  const data={
    id: cliente?cliente.id:nextClientId(),
    porta: porta,
    nome: nome,
    endereco: document.getElementById('cli-endereco').value.trim(),
    telefone: document.getElementById('cli-telefone').value.trim(),
    plano: document.getElementById('cli-plano').value.trim(),
    onuSerial: document.getElementById('cli-onu').value.trim(),
    obs: document.getElementById('cli-obs').value.trim(),
    ativo: document.getElementById('cli-ativo').value==='true',
    atualizadoEm: Date.now()
  };
  const arr=getClientesOf(parent);
  if(cliente){
    const i=arr.findIndex(c=>c.id===cliente.id);
    if(i>=0)arr[i]=data;
  }else{
    // Garante uma porta = um cliente ativo
    const existing=arr.findIndex(c=>c.porta===porta&&c.ativo!==false);
    if(existing>=0){
      // Se já tem cliente ativo nesta porta, marca o antigo como inativo
      arr[existing].ativo=false;
    }
    arr.push(data);
  }
  closeClienteModal();
  scheduleAutosave&&scheduleAutosave();
  stateManager&&stateManager.pushState('Cliente '+(cliente?'editado':'criado')+': '+nome);
  // Atualiza o modal do elemento se ainda estiver aberto
  if(currentEM&&currentEM.id===parent.id)openEmModal(parent);
  // Atualiza sidebar
  debouncedUpdList&&debouncedUpdList();
  showToast('✓ Cliente '+(cliente?'atualizado':'cadastrado')+': '+nome,'success');
}

function deleteCliente(){
  if(!_clientCtx||!_clientCtx.cliente)return;
  const {parent, cliente} = _clientCtx;
  showConf('Remover cliente?','Tem certeza que deseja remover <b>'+cliente.nome+'</b>? Esta ação pode ser desfeita.',()=>{
    parent.clientes=(parent.clientes||[]).filter(c=>c.id!==cliente.id);
    closeClienteModal();
    scheduleAutosave&&scheduleAutosave();
    stateManager&&stateManager.pushState('Remover cliente '+cliente.nome);
    if(currentEM&&currentEM.id===parent.id)openEmModal(parent);
    debouncedUpdList&&debouncedUpdList();
    showToast('Cliente removido','info');
  });
}

// ═══ Renderiza tabela de clientes dentro do modal de CTO/Deriv ═══
function renderClientesTable(d){
  if(d.tipo!=='cto'&&d.tipo!=='deriv')return '';
  const ports = d.portas || d.capacidade || 8;
  const arr = (d.clientes||[]).filter(c=>c.ativo!==false);
  let html = `
    <div class="prs">
      <div class="prt" style="display:flex;align-items:center;gap:8px">
        <span>Clientes vinculados</span>
        <span style="background:var(--green2);color:#fff;padding:1px 7px;border-radius:10px;font-size:10px;font-family:var(--mono)">${arr.length}/${ports}</span>
      </div>
      <div class="cli-table">`;
  for(let p=0;p<ports;p++){
    const c = getClienteOnPort(d, p);
    const pLbl = d.tipo==='cto'?'Porta '+(p+1):'Saída '+(p+1);
    if(c){
      html += `<div class="cli-trow filled" onclick="openClienteModal(findById('${escJs(d.id)}'),${p},(findById('${escJs(d.id)}').clientes||[]).find(x=>x.id==='${escJs(c.id)}'))">
        <span class="cli-port">${escH(pLbl)}</span>
        <span class="cli-name"><b>${escH(c.nome)}</b>${c.plano?' <span style="color:var(--text3);font-size:9px">'+escH(c.plano)+'</span>':''}</span>
        <span class="cli-meta">${escH(c.endereco||'—')}</span>
        <span class="cli-edit">✏️</span>
      </div>`;
    }else{
      html += `<div class="cli-trow empty" onclick="openClienteModal(findById('${escJs(d.id)}'),${p})">
        <span class="cli-port">${escH(pLbl)}</span>
        <span class="cli-name" style="color:var(--text3);font-style:italic">Livre</span>
        <span class="cli-meta"></span>
        <span class="cli-edit">+</span>
      </div>`;
    }
  }
  html += `</div></div>`;
  return html;
}

// ═══ Hook na construção do modal de elemento ═══
// Wrap direto em openEmModal — substitui o MutationObserver que tinha risco de
// loop e disparava em qualquer mutação no #em-body.
(function patchEmModal(){
  if(window._clientsPatched)return;
  window._clientsPatched=true;
  const orig=window.openEmModal;
  if(typeof orig!=='function')return;
  window.openEmModal=function(d){
    orig.apply(this,arguments);
    if(!d||(d.tipo!=='cto'&&d.tipo!=='deriv'))return;
    const body=document.getElementById('em-body');
    if(!body)return;
    const tab=body.querySelector('.etc');
    if(!tab||tab.querySelector('.cli-table'))return;
    const html=renderClientesTable(d);
    const pact=tab.querySelector('.pact');
    if(pact)pact.insertAdjacentHTML('beforebegin',html);
    else tab.insertAdjacentHTML('beforeend',html);
  };
})();

// ═══ Estende a árvore lateral (updList) com clientes dentro de PON ═══
// Adicionamos os clientes vinculados aos CTOs que aparecem no caminho da PON
function clientesNoCaminho(oltId, ponIdx){
  const hops = (typeof traceFiberGlobal==='function')?traceFiberGlobal('out:'+oltId,ponIdx):[];
  const out=[];
  hops.forEach(h=>{
    if(h.eid.startsWith('out:')){
      const sid=h.eid.slice(4);
      const el=findById(sid);
      if(el&&(el.tipo==='cto'||el.tipo==='deriv')){
        const c=getClienteOnPort(el,h.fi);
        if(c)out.push({cto:el,porta:h.fi,cliente:c});
      }
    }
  });
  return out;
}

// ═══ Export CSV de todos os clientes ═══
function exportClientesCSV(){
  const all = listAllClientes();
  if(!all.length){showToast('Nenhum cliente cadastrado','warning');return;}
  const headers = ['id','nome','endereco','telefone','plano','onuSerial','status','elemento_tipo','elemento_nome','elemento_id','porta','observacoes','atualizado_em'];
  const rows = [headers.join(';')];
  all.forEach(c=>{
    const p = c.parent;
    const row = [
      c.id||'',
      (c.nome||'').replace(/;/g,','),
      (c.endereco||'').replace(/;/g,','),
      (c.telefone||'').replace(/;/g,','),
      (c.plano||'').replace(/;/g,','),
      (c.onuSerial||'').replace(/;/g,','),
      c.ativo!==false?'ativo':'inativo',
      p.tipo,
      (p.nome||p.id).replace(/;/g,','),
      p.id,
      (c.porta+1),
      (c.obs||'').replace(/;/g,','),
      c.atualizadoEm?new Date(c.atualizadoEm).toISOString():''
    ];
    rows.push(row.join(';'));
  });
  const csv = '﻿'+rows.join('\n'); // BOM pra Excel reconhecer UTF-8
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clientes_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();URL.revokeObjectURL(a.href);
  showToast('📊 Exportados '+all.length+' clientes','success');
}

function importClientesCSV(evt){
  const file = evt.target.files[0];
  if(!file)return;
  evt.target.value='';
  const r = new FileReader();
  r.onload = e => {
    try{
      const text = String(e.target.result).replace(/^﻿/,'');
      const lines = text.split(/\r?\n/).filter(l=>l.trim());
      if(lines.length<2){showToast('CSV vazio','warning');return;}
      // Detecta separador
      const sep = lines[0].includes(';')?';':',';
      const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase());
      const idx = name => headers.indexOf(name);
      const iNome = idx('nome');
      const iEnd = idx('endereco');
      const iTel = idx('telefone');
      const iPlano = idx('plano');
      const iOnu = idx('onuserial');
      const iElemId = idx('elemento_id');
      const iPorta = idx('porta');
      const iStatus = idx('status');
      const iObs = idx('observacoes');
      if(iNome<0||iElemId<0||iPorta<0){
        showToast('CSV inválido — precisa colunas: nome, elemento_id, porta','error');
        return;
      }
      let ok=0,skip=0;
      for(let i=1;i<lines.length;i++){
        const cols = lines[i].split(sep);
        const elemId = (cols[iElemId]||'').trim();
        const porta = parseInt(cols[iPorta]||'0',10) - 1;
        const parent = findById(elemId);
        if(!parent||(parent.tipo!=='cto'&&parent.tipo!=='deriv')){skip++;continue;}
        if(porta<0||porta>=(parent.portas||parent.capacidade||8)){skip++;continue;}
        const arr = getClientesOf(parent);
        // Desativa existente nessa porta
        arr.filter(c=>c.porta===porta&&c.ativo!==false).forEach(c=>c.ativo=false);
        arr.push({
          id: nextClientId(),
          porta,
          nome: (cols[iNome]||'').trim(),
          endereco: iEnd>=0?(cols[iEnd]||'').trim():'',
          telefone: iTel>=0?(cols[iTel]||'').trim():'',
          plano: iPlano>=0?(cols[iPlano]||'').trim():'',
          onuSerial: iOnu>=0?(cols[iOnu]||'').trim():'',
          obs: iObs>=0?(cols[iObs]||'').trim():'',
          ativo: iStatus>=0?((cols[iStatus]||'').trim().toLowerCase()!=='inativo'):true,
          atualizadoEm: Date.now()
        });
        ok++;
      }
      if(typeof scheduleAutosave==='function')scheduleAutosave();
      if(typeof debouncedUpdList==='function')debouncedUpdList();
      showToast(`✓ Importados ${ok} clientes${skip?' ('+skip+' ignorados)':''}`,'success');
    }catch(err){showToast('Erro no CSV: '+err.message,'error');}
  };
  r.readAsText(file);
}

function downloadClientesTemplate(){
  const csv = '﻿nome;endereco;telefone;plano;onuSerial;status;elemento_id;porta;observacoes\nJoão Silva;Rua A, 100;(11) 9999-8888;500 MB;HWTC0001;ativo;CTO-01;3;Cliente padrão';
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clientes_template.csv';
  a.click();URL.revokeObjectURL(a.href);
}

// ═══ Painel global de Clientes (lista pesquisável) ═══
function showClientesPanel(){
  let ov = document.getElementById('clientes-panel-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'clientes-panel-overlay';
    ov.className = 'cliente-overlay';
    ov.addEventListener('click', e=>{if(e.target===ov)closeClientesPanel();});
    document.body.appendChild(ov);
  }
  const all = listAllClientes();
  const ativos = all.filter(c=>c.ativo!==false).length;
  ov.innerHTML = `
    <div class="cli-modal" style="width:min(720px,96vw);max-height:88vh">
      <div class="cli-hdr">
        <div>
          <h2>👥 Clientes (${all.length})</h2>
          <p>${ativos} ativos · ${all.length-ativos} inativos</p>
        </div>
        <button class="cc-close" onclick="closeClientesPanel()">✕</button>
      </div>
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input class="cm-input" id="cp-search" placeholder="Buscar nome / endereço / ONU…" style="flex:1;min-width:160px" oninput="renderClientesPanelList()">
        <button class="cm-btn" onclick="exportClientesCSV()" title="Baixar CSV">↓ Exportar CSV</button>
        <button class="cm-btn" onclick="document.getElementById('fcli').click()" title="Importar em lote">↑ Importar CSV</button>
        <button class="cm-btn" onclick="downloadClientesTemplate()" title="Modelo CSV">📋 Modelo</button>
        <input type="file" id="fcli" accept=".csv,.txt" onchange="importClientesCSV(event)" style="display:none">
      </div>
      <div class="cli-body" id="cp-list" style="padding:8px 16px"></div>
    </div>`;
  ov.classList.add('show');
  renderClientesPanelList();
}
function closeClientesPanel(){const ov=document.getElementById('clientes-panel-overlay');if(ov)ov.classList.remove('show');}
function renderClientesPanelList(){
  const q = (document.getElementById('cp-search')||{}).value || '';
  const ql = q.toLowerCase().trim();
  const all = listAllClientes();
  const filtered = ql ? all.filter(c => {
    const fields = [c.nome,c.endereco,c.telefone,c.onuSerial,c.plano,(c.parent.nome||c.parent.id)].filter(Boolean).join(' ').toLowerCase();
    return fields.includes(ql);
  }) : all;
  const el = document.getElementById('cp-list');
  if(!el)return;
  if(!filtered.length){el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-family:var(--mono)">Nenhum cliente encontrado.</div>';return;}
  let html = '';
  filtered.sort((a,b)=>{
    if((a.ativo!==false)!==(b.ativo!==false))return (a.ativo!==false)?-1:1;
    return (a.nome||'').localeCompare(b.nome||'');
  });
  filtered.forEach(c=>{
    const inactive = c.ativo===false;
    const pl = c.parent;
    const tlbl = pl.tipo==='cto'?'CTO':'Deriv';
    html += `<div class="cp-row${inactive?' inactive':''}" onclick="closeClientesPanel();openClienteFromSearch('${escJs(pl.id)}','${escJs(c.id)}')">
      <div class="cp-main">
        <div class="cp-name">${inactive?'<span style="color:#9ca3af">○</span> ':'<span style="color:#10B981">●</span> '}<b>${escH(c.nome)}</b>${c.plano?' <span style="color:var(--text3);font-size:10px;font-family:var(--mono)">'+escH(c.plano)+'</span>':''}</div>
        <div class="cp-meta">${c.endereco?escH(c.endereco)+' · ':''}${tlbl} ${escH(pl.nome||pl.id)} · porta ${c.porta+1}${c.onuSerial?' · ONU '+escH(c.onuSerial):''}</div>
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

// ESC do modal de cliente é tratado em features.js _handleFeatureKeys (consolidado).

// ═══ Persistência: garante que `clientes` é serializado junto com CTO/Deriv ═══
// Como ctos/derivs já são copiados via spread em buildProjectSnapshot e
// applyProjectSnapshot já usa `...c`, o array `clientes` é preservado automaticamente.
// Ao carregar de projetos antigos sem `clientes`, inicializa vazio.
(function migrateClients(){
  window.addEventListener('load',()=>{
    setTimeout(()=>{
      [].concat(ctos||[],derivs||[]).forEach(p=>{if(!p.clientes)p.clientes=[];});
      // Recupera maior contador
      let maxN=0;
      listAllClientes().forEach(c=>{
        const m=(c.id||'').match(/^CL(\d+)$/);
        if(m)maxN=Math.max(maxN,parseInt(m[1]));
      });
      _clientCnt=maxN;
    },1000);
  });
})();

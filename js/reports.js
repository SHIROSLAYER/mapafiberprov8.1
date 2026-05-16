// ═══════════════════════════════════════════════
// reports.js — Geração de relatórios PDF (jsPDF)
// ═══════════════════════════════════════════════

function _getJsPDF(){
  // jsPDF 2.x UMD expõe window.jspdf.jsPDF
  if(window.jspdf&&window.jspdf.jsPDF)return window.jspdf.jsPDF;
  if(window.jsPDF)return window.jsPDF;
  return null;
}

// Helpers de formato
function _fmtDist(m){
  if(m==null||isNaN(m))return '—';
  const km=Math.floor(m/1000), mr=Math.round(m%1000);
  return km>0?(km+'km.'+mr+'m'):(mr+'m');
}
function _fmtNow(){
  const d=new Date();
  return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

// ═══════ RELATÓRIO DE CABO ═══════
function generateCableReport(cab){
  const PDF=_getJsPDF();
  if(!PDF){showToast('Biblioteca jsPDF não carregada','error');return;}
  const doc=new PDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210, H=297, M=15;
  let y=M;

  // === Cabeçalho ===
  doc.setFillColor(13,107,80);
  doc.rect(0,0,W,22,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.text('FiberMap Pro',M,12);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text('Relatório de Cabo Óptico',M,18);
  doc.setFontSize(8);
  doc.text(_fmtNow(),W-M,12,{align:'right'});
  doc.text('v'+(typeof WELCOME_VERSION!=='undefined'?WELCOME_VERSION:'8.x'),W-M,17,{align:'right'});
  y=32;

  // === Cabeçalho do cabo ===
  doc.setTextColor(13,107,80);
  doc.setFontSize(20);
  doc.setFont('helvetica','bold');
  doc.text(cab.nome||cab.id,M,y);y+=8;
  doc.setTextColor(110,110,110);
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text(cab.typeName||cab.typeId||'Cabo óptico',M,y);y+=10;

  // === Dados gerais (tabela 2 colunas) ===
  doc.setDrawColor(220,220,220);
  doc.setLineWidth(0.3);
  doc.line(M,y,W-M,y);y+=6;

  const att=(typeof calcAtt==='function')?calcAtt(cab):null;
  const anchors=Object.values(cab.anchorMap||{}).map(id=>{const el=(typeof findById==='function')?findById(id):null;return el?(el.nome||el.id):id;});
  const props=[
    ['ID', cab.id],
    ['Tipo', cab.typeName||cab.typeId||'—'],
    ['Estrutura', (cab.grupos||1)+' tubo(s) × '+(cab.fpg||12)+' fibras = '+(cab.total||cab.grupos*cab.fpg||0)+' FO'],
    ['Estilo', {conv:'Convencional',fig8:'Figura 8',adss:'ADSS',drop:'Drop Indoor',blind:'Blindado',diel:'Dielétrico'}[cab.estilo]||cab.estilo||'—'],
    ['Comprimento', _fmtDist(cab.dist)],
    ['Cor no mapa', cab.color],
    ['Ancoragens', anchors.length?anchors.join(' → '):'sem âncoras'],
    ['Observações', cab.obs||'—']
  ];
  doc.setFontSize(9);
  props.forEach(([k,v])=>{
    doc.setTextColor(110,110,110);
    doc.text(k,M,y);
    doc.setTextColor(30,30,30);
    doc.setFont('helvetica','bold');
    const lines=doc.splitTextToSize(String(v),W-M-50);
    doc.text(lines,M+45,y);
    doc.setFont('helvetica','normal');
    y+=Math.max(5,lines.length*4.5);
  });
  y+=4;

  // === Atenuação ===
  if(att){
    doc.setFillColor(240,250,245);
    doc.rect(M,y,W-2*M,30,'F');
    doc.setTextColor(13,107,80);
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('Atenuação calculada',M+3,y+5);
    doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    doc.setTextColor(70,70,70);
    const lines=[
      'Fibra ('+(typeof ATT!=='undefined'?ATT.fibra:0.35)+' dB/km × '+_fmtDist(cab.dist)+'):  '+att.af.toFixed(2)+' dB',
      'Emendas (×'+att.ec+'):  '+(att.ec*(typeof ATT!=='undefined'?ATT.emenda:0.1)).toFixed(2)+' dB',
      'Splitters:  '+(att.splitterLoss||0).toFixed(2)+' dB',
      'Conectores (×2):  '+((typeof ATT!=='undefined'?ATT.conector:0.5)*2).toFixed(2)+' dB',
      'TOTAL:  '+att.tot.toFixed(2)+' dB  /  Budget: '+(typeof ATT!=='undefined'?ATT.budget:28)+' dB',
    ];
    lines.forEach((l,i)=>doc.text(l,M+3,y+10+i*4));
    // status
    const okColor=att.margin>=5?[16,185,129]:att.margin>=0?[245,158,11]:[239,68,68];
    doc.setFillColor.apply(doc,okColor);
    doc.rect(W-M-40,y+5,38,8,'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    const status=att.margin>=5?'OK '+att.margin.toFixed(1)+' dB':att.margin>=0?'LIMITE '+att.margin.toFixed(1)+' dB':'EXCEDE '+Math.abs(att.margin).toFixed(1)+' dB';
    doc.text(status,W-M-21,y+10.5,{align:'center'});
    y+=36;
  }

  // === Tabela de fibras (com OLT conectada) ===
  if(y>240){doc.addPage();y=M;}
  doc.setTextColor(13,107,80);
  doc.setFont('helvetica','bold');
  doc.setFontSize(12);
  doc.text('Mapeamento de fibras',M,y);y+=6;

  // Header
  doc.setFillColor(40,40,40);
  doc.rect(M,y,W-2*M,7,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.text('#',M+2,y+5);
  doc.text('Tubo · Fibra',M+12,y+5);
  doc.text('Cor ABNT',M+50,y+5);
  doc.text('OLT / Destino',M+85,y+5);
  doc.text('Status',W-M-25,y+5);
  y+=10;

  const total=cab.total||(cab.grupos*cab.fpg)||12;
  const fpg=cab.fpg||12, grupos=cab.grupos||1;
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  for(let i=0;i<total;i++){
    if(y>275){doc.addPage();y=M;}
    const a=(typeof abntColor==='function')?abntColor(i,fpg):{fiberN:i+1,tubeN:1,fiber:{name:'?',hex:'#888'}};
    const olt=(typeof findOLTForFiber==='function')?findOLTForFiber(cab.id,i):null;
    // zebra
    if(i%2===0){doc.setFillColor(248,250,252);doc.rect(M,y-3,W-2*M,5,'F');}
    doc.setTextColor(60,60,60);
    doc.text(String(i+1),M+2,y);
    doc.text(grupos>1?('T'+a.tubeN+' · F'+a.fiberN):('F'+a.fiberN),M+12,y);
    // bolinha colorida
    try{
      const hex=a.fiber.hex.replace('#','');
      const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
      doc.setFillColor(r,g,b);
      doc.circle(M+52,y-1,1.5,'F');
    }catch(_){}
    doc.text(a.fiber.name||'?',M+56,y);
    if(olt){
      doc.setTextColor(13,107,80);
      doc.setFont('helvetica','bold');
      doc.text('OLT '+olt.nome+' · PON '+olt.pon,M+85,y);
      doc.setTextColor(16,185,129);
      doc.text('●',W-M-22,y);
      doc.setFont('helvetica','normal');
    }else{
      doc.setTextColor(160,160,160);
      doc.text('— não conectada',M+85,y);
      doc.setTextColor(180,180,180);
      doc.text('○',W-M-22,y);
    }
    y+=5;
  }

  // === Rodapé com paginação ===
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150,150,150);
    doc.text('FiberMap Pro · Página '+p+' de '+pages,W/2,H-6,{align:'center'});
  }

  const fname='relatorio_'+(cab.nome||cab.id).replace(/[^a-z0-9_-]+/gi,'_')+'_'+new Date().toISOString().slice(0,10)+'.pdf';
  doc.save(fname);
  showToast('📄 PDF gerado: '+fname,'success');
}

// ═══════ RELATÓRIO DE CIRCUITO (OLT.PON → cliente) ═══════
function generatePONReport(oltId,ponIdx){
  const PDF=_getJsPDF();
  if(!PDF){showToast('jsPDF não disponível','error');return;}
  const olt=findById(oltId);
  if(!olt){showToast('OLT não encontrada','error');return;}
  const doc=new PDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210, M=15;
  let y=M;

  // Header
  doc.setFillColor(6,182,212);
  doc.rect(0,0,W,22,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.text('Relatório de Circuito PON',M,12);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text('OLT '+(olt.nome||olt.id)+' · PON '+(ponIdx+1),M,18);
  doc.setFontSize(8);
  doc.text(_fmtNow(),W-M,17,{align:'right'});
  y=32;

  // Trace
  const hops=(typeof traceFiberGlobal==='function')?traceFiberGlobal('out:'+oltId,ponIdx):[];

  doc.setTextColor(20,20,20);
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.text('Trajeto: '+hops.length+' elemento(s)',M,y);y+=8;

  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(80,80,80);
  doc.text('Caminho da fibra desde a porta da OLT até o endpoint final.',M,y);y+=10;

  if(hops.length<=1){
    doc.setTextColor(180,80,80);
    doc.setFont('helvetica','bold');
    doc.text('⚠ Esta PON não está conectada a nenhum cabo no momento.',M,y);
    y+=10;
  }
  hops.forEach((h,i)=>{
    if(y>270){doc.addPage();y=M;}
    const dec=(typeof decodeGlobalEndpoint==='function')?decodeGlobalEndpoint(h.eid,h.fi):{tipo:'?',nome:h.eid,detail:'fi '+h.fi};
    // Caixa
    doc.setFillColor(245,250,250);
    doc.rect(M,y-4,W-2*M,12,'F');
    // numero
    doc.setFillColor(13,107,80);
    doc.circle(M+5,y+2,3.5,'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.text(String(i+1),M+5,y+3.5,{align:'center'});
    // tipo + nome
    doc.setTextColor(13,107,80);
    doc.setFontSize(10);
    doc.text(dec.tipo+' '+dec.nome,M+12,y+1);
    doc.setTextColor(110,110,110);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.text(dec.detail,M+12,y+6);
    y+=14;
    // seta entre hops
    if(i<hops.length-1){
      doc.setTextColor(150,150,150);
      doc.setFontSize(10);
      doc.text(h.viaCable?'↓ atravessa o cabo':'↓ conectado a',M+8,y);
      y+=6;
    }
  });
  y+=8;

  // Clientes vinculados a CTOs no caminho
  const clientsInPath=[];
  hops.forEach(h=>{
    if(h.eid.startsWith('out:')){
      const sid=h.eid.slice(4);
      const el=findById(sid);
      if(el&&(el.tipo==='cto'||el.tipo==='deriv')){
        const clientes=(el.clientes||[]).filter(c=>c.porta===h.fi);
        clientes.forEach(c=>clientsInPath.push({elem:el,porta:h.fi,cliente:c}));
      }
    }
  });
  if(clientsInPath.length){
    if(y>240){doc.addPage();y=M;}
    doc.setTextColor(13,107,80);
    doc.setFont('helvetica','bold');
    doc.setFontSize(13);
    doc.text('Clientes neste circuito ('+clientsInPath.length+')',M,y);y+=8;
    doc.setFontSize(9);
    clientsInPath.forEach(c=>{
      if(y>275){doc.addPage();y=M;}
      doc.setTextColor(40,40,40);
      doc.setFont('helvetica','bold');
      doc.text('• '+c.cliente.nome,M,y);y+=4;
      doc.setTextColor(110,110,110);
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.text('  '+c.elem.tipo.toUpperCase()+' '+(c.elem.nome||c.elem.id)+' · porta '+(c.porta+1),M,y);y+=4;
      if(c.cliente.endereco)doc.text('  Endereço: '+c.cliente.endereco,M,y),y+=4;
      if(c.cliente.plano)doc.text('  Plano: '+c.cliente.plano,M,y),y+=4;
      if(c.cliente.onuSerial)doc.text('  ONU SN: '+c.cliente.onuSerial,M,y),y+=4;
      doc.setFontSize(9);
      y+=2;
    });
  }

  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150,150,150);
    doc.text('FiberMap Pro · Pág. '+p+'/'+pages,W/2,290,{align:'center'});
  }
  const fname='circuito_'+(olt.nome||olt.id).replace(/[^a-z0-9_-]+/gi,'_')+'_PON'+(ponIdx+1)+'_'+new Date().toISOString().slice(0,10)+'.pdf';
  doc.save(fname);
  showToast('📄 PDF gerado: '+fname,'success');
}

// ═══════ RELATÓRIO DO PROJETO INTEIRO (consolidado completo) ═══════
function generateProjectReport(){
  const PDF=_getJsPDF();
  if(!PDF){showToast('jsPDF não disponível','error');return;}
  const doc=new PDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210, H=297, M=15;
  let y=M;

  // ─── Helpers locais ───
  function checkPage(threshold){if(y>(threshold||275)){doc.addPage();y=M;}}
  function sectionTitle(text){
    checkPage(265);
    doc.setFontSize(13);doc.setTextColor(13,107,80);doc.setFont('helvetica','bold');
    doc.text(text,M,y);y+=6;
    doc.setDrawColor(13,107,80);doc.setLineWidth(0.4);
    doc.line(M,y-1,W-M,y-1);y+=3;
  }
  function tableHeader(cols){
    doc.setFillColor(40,40,40);
    doc.rect(M,y,W-2*M,6,'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    cols.forEach(c=>doc.text(c.label,M+c.x,y+4));
    y+=7;
    doc.setFont('helvetica','normal');
  }
  function zebraRow(i,h){
    if(i%2===0){doc.setFillColor(248,250,252);doc.rect(M,y-3,W-2*M,(h||5),'F');}
  }
  function kv(k,v,colorVal){
    doc.setTextColor(110,110,110);doc.text(k,M,y);
    if(colorVal)doc.setTextColor.apply(doc,colorVal);
    else doc.setTextColor(30,30,30);
    doc.setFont('helvetica','bold');doc.text(String(v),M+55,y);
    doc.setFont('helvetica','normal');y+=5;
  }

  // ─── Cabeçalho ───
  doc.setFillColor(13,107,80);
  doc.rect(0,0,W,22,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');doc.setFontSize(18);
  doc.text('Relatório do Projeto',M,12);
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  doc.text('FiberMap Pro · Visão consolidada da rede de fibra óptica',M,18);
  doc.setFontSize(8);
  doc.text(_fmtNow(),W-M,12,{align:'right'});
  doc.text('v'+(typeof WELCOME_VERSION!=='undefined'?WELCOME_VERSION:'9.x'),W-M,17,{align:'right'});
  y=30;

  // ─── Cálculos consolidados ───
  const totalCabo=cabos.reduce((s,c)=>s+(c.dist||0),0);
  const totalFO=cabos.reduce((s,c)=>s+(c.total||c.grupos*c.fpg||0),0);
  // Postes com/sem sub-elementos
  const postesComSub=postes.filter(p=>(p.children||[]).length>0);
  const postesSemSub=postes.length-postesComSub.length;
  // Contagem de tipos vinculados a postes
  let postesComCto=0, postesComDeriv=0, postesComEmenda=0;
  postes.forEach(p=>{
    const tipos=new Set((p.children||[]).map(c=>c.tipo));
    if(tipos.has('cto'))postesComCto++;
    if(tipos.has('deriv'))postesComDeriv++;
    if(tipos.has('emenda'))postesComEmenda++;
  });
  // OLT usage
  let ponsTotal=0, ponsUsadas=0;
  olts.forEach(o=>{
    const t=o.portas||16;ponsTotal+=t;
    if(typeof getOltUsage==='function'){const u=getOltUsage(o.id,t);ponsUsadas+=u.used;}
  });
  // Cabos por tipo + km por tipo
  const cabosPorTipo={};
  cabos.forEach(c=>{
    const t=c.typeName||c.typeId||'custom';
    if(!cabosPorTipo[t])cabosPorTipo[t]={qtd:0,km:0,fo:0};
    cabosPorTipo[t].qtd++;
    cabosPorTipo[t].km+=(c.dist||0);
    cabosPorTipo[t].fo+=(c.total||c.grupos*c.fpg||0);
  });
  // Atenuação status
  let attOK=0,attLimite=0,attExcede=0,attSemDist=0;
  cabos.forEach(c=>{
    const att=(typeof calcAtt==='function')?calcAtt(c):null;
    if(!att||!c.dist){attSemDist++;return;}
    if(att.margin>=5)attOK++;
    else if(att.margin>=0)attLimite++;
    else attExcede++;
  });
  // Clientes
  let totalClientes=0, clientesAtivos=0;
  [...ctos,...derivs].forEach(el=>{
    (el.clientes||[]).forEach(c=>{
      totalClientes++;
      if(c.ativo!==false)clientesAtivos++;
    });
  });
  // CTOs com clientes vs vazias
  const ctosOcup=ctos.filter(c=>(c.clientes||[]).length>0).length;
  const ctosVazias=ctos.length-ctosOcup;
  // Portas totais de CTO e ocupação
  let portasCtoTotal=0, portasCtoOcup=0;
  ctos.forEach(c=>{
    const t=c.portas||8;portasCtoTotal+=t;
    portasCtoOcup+=(c.clientes||[]).filter(cl=>cl.ativo!==false).length;
  });
  // MPLS fibras em uso
  let mplsFibrasTotal=0, mplsFibrasUsadas=0;
  (mpls||[]).forEach(m=>{
    const t=m.portas||4;mplsFibrasTotal+=t;
    [...armarios,...postes].forEach(d=>{
      ((d.fibers&&d.fibers.connections)||[]).forEach(c=>{
        if(c.fromId==='out:'+m.id||c.toId==='out:'+m.id)mplsFibrasUsadas++;
      });
    });
  });
  // Conexões órfãs
  let conexoesOrf=0;
  [...armarios,...postes].forEach(d=>{
    ((d.fibers&&d.fibers.connections)||[]).forEach(c=>{
      const ok=(eid)=>{
        if(eid.startsWith('cable:'))return !!cabos.find(cb=>cb.id===eid.slice(6).replace('::I','').replace('::O',''));
        if(eid.startsWith('in:')||eid.startsWith('out:'))return !!findById(eid.slice(eid.indexOf(':')+1));
        return true;
      };
      if(!ok(c.fromId)||!ok(c.toId))conexoesOrf++;
    });
  });

  // ─── SEÇÃO 1: Sumário Executivo ───
  sectionTitle('1. Sumário Executivo');
  doc.setFontSize(10);doc.setFont('helvetica','normal');
  kv('Total de elementos', armarios.length+postes.length+olts.length+(mpls||[]).length+ctos.length+emendas.length+derivs.length);
  kv('Comprimento total de cabo', _fmtDist(totalCabo));
  kv('Fibras ópticas totais', totalFO+' FO');
  kv('Cabos traçados', cabos.length);
  kv('Clientes cadastrados', totalClientes+(totalClientes!==clientesAtivos?(' ('+clientesAtivos+' ativos)'):''));
  y+=5;

  // ─── SEÇÃO 2: Distribuição de elementos ───
  sectionTitle('2. Distribuição de elementos');
  const dist=[
    ['Armários', armarios.length, '#EC4899'],
    ['Postes', postes.length, '#3B82F6'],
    ['OLTs', olts.length, '#06B6D4'],
    ['MPLS', (mpls||[]).length, '#EF4444'],
    ['CTOs', ctos.length, '#F59E0B'],
    ['Derivações', derivs.length, '#8B5CF6'],
    ['Emendas (CEO)', emendas.length, '#EF4444'],
    ['Cabos ópticos', cabos.length, '#1D9E75']
  ];
  doc.setFontSize(9);
  dist.forEach(([k,v,col])=>{
    const hex=col.replace('#','');
    const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
    doc.setFillColor(r,g,b);doc.circle(M+2,y-1,1.5,'F');
    doc.setTextColor(110,110,110);doc.text(k,M+8,y);
    doc.setTextColor(30,30,30);doc.setFont('helvetica','bold');
    doc.text(String(v),M+60,y);doc.setFont('helvetica','normal');
    y+=5;
  });
  y+=4;

  // ─── SEÇÃO 3: Status da rede ───
  sectionTitle('3. Status da Rede');
  doc.setFontSize(10);
  // OLT
  if(ponsTotal>0){
    const pct=Math.round(100*ponsUsadas/ponsTotal);
    const col=pct>=90?[239,68,68]:pct>=70?[245,158,11]:[16,185,129];
    kv('Ocupação OLT', ponsUsadas+'/'+ponsTotal+' PONs ('+pct+'%)', col);
  }
  // MPLS
  if(mplsFibrasTotal>0){
    const pct=Math.round(100*mplsFibrasUsadas/mplsFibrasTotal);
    kv('Ocupação MPLS', mplsFibrasUsadas+'/'+mplsFibrasTotal+' fibras ('+pct+'%)');
  }
  // CTOs
  if(portasCtoTotal>0){
    const pct=Math.round(100*portasCtoOcup/portasCtoTotal);
    kv('Ocupação CTOs', portasCtoOcup+'/'+portasCtoTotal+' portas ('+pct+'%)');
    kv('CTOs ocupadas', ctosOcup+' · '+ctosVazias+' vazias');
  }
  // Postes
  kv('Postes com elementos', postesComSub.length+' / '+postes.length+' ('+(postes.length?Math.round(100*postesComSub.length/postes.length):0)+'%)');
  kv('  ↳ com CTO', postesComCto);
  kv('  ↳ com Derivação', postesComDeriv);
  kv('  ↳ com Emenda', postesComEmenda);
  kv('Postes sem elementos', postesSemSub);
  // Cabos
  kv('Cabos OK (atenuação <23dB)', attOK, [16,185,129]);
  if(attLimite>0)kv('Cabos no LIMITE (23-28dB)', attLimite, [245,158,11]);
  if(attExcede>0)kv('Cabos EXCEDEM budget (>28dB)', attExcede, [239,68,68]);
  if(attSemDist>0)kv('Cabos sem distância', attSemDist);
  if(conexoesOrf>0)kv('⚠ Conexões órfãs detectadas', conexoesOrf, [239,68,68]);
  y+=4;

  // ─── SEÇÃO 4: Cabos por tipo ───
  sectionTitle('4. Cabos por tipo');
  doc.setFontSize(9);
  tableHeader([
    {label:'Tipo',x:2},{label:'Qtd',x:75},{label:'Comprimento total',x:100},{label:'FOs totais',x:160}
  ]);
  let ti=0;
  Object.entries(cabosPorTipo).sort((a,b)=>b[1].km-a[1].km).forEach(([t,info])=>{
    checkPage(275);
    zebraRow(ti++);
    doc.setTextColor(40,40,40);
    doc.text(t.slice(0,38),M+2,y);
    doc.text(String(info.qtd),M+75,y);
    doc.text(_fmtDist(info.km),M+100,y);
    doc.text(info.fo+' FO',M+160,y);
    y+=5;
  });
  y+=4;

  // ─── SEÇÃO 5: OLTs ───
  if(olts.length){
    sectionTitle('5. OLTs ('+olts.length+')');
    tableHeader([
      {label:'Nome',x:2},{label:'Armário pai',x:60},{label:'PONs',x:115},{label:'Uso',x:140},{label:'Clientes',x:165}
    ]);
    olts.forEach((o,i)=>{
      checkPage(275);zebraRow(i);
      const pai=o.parentId?findById(o.parentId):null;
      const u=typeof getOltUsage==='function'?getOltUsage(o.id,o.portas||16):{used:0,total:o.portas||16,pct:0};
      // Conta clientes alcançados via global trace
      let cli=0;
      if(typeof traceFiberGlobal==='function'){
        for(let pi=0;pi<u.total;pi++){
          const hops=traceFiberGlobal('out:'+o.id,pi);
          hops.forEach(h=>{
            if(h.eid.startsWith('out:')){
              const sid=h.eid.slice(4);const el=findById(sid);
              if(el&&(el.tipo==='cto'||el.tipo==='deriv')){
                cli+=(el.clientes||[]).filter(c=>c.porta===h.fi&&c.ativo!==false).length;
              }
            }
          });
        }
      }
      doc.setTextColor(40,40,40);
      doc.text((o.nome||o.id).slice(0,32),M+2,y);
      doc.text((pai?(pai.nome||pai.id):'—').slice(0,28),M+60,y);
      doc.text(String(u.total),M+115,y);
      const col=u.pct>=0.9?[239,68,68]:u.pct>=0.7?[245,158,11]:[16,185,129];
      doc.setTextColor.apply(doc,col);doc.setFont('helvetica','bold');
      doc.text(u.used+' ('+Math.round(u.pct*100)+'%)',M+140,y);
      doc.setFont('helvetica','normal');doc.setTextColor(40,40,40);
      doc.text(String(cli),M+165,y);
      y+=5;
    });
    y+=4;
  }

  // ─── SEÇÃO 6: MPLS ───
  if((mpls||[]).length){
    sectionTitle('6. MPLS ('+mpls.length+')');
    tableHeader([
      {label:'Nome',x:2},{label:'Armário pai',x:80},{label:'Fibras',x:140},{label:'Em uso',x:170}
    ]);
    mpls.forEach((m,i)=>{
      checkPage(275);zebraRow(i);
      const pai=m.parentId?findById(m.parentId):null;
      let usadas=0;
      [...armarios,...postes].forEach(d=>{
        ((d.fibers&&d.fibers.connections)||[]).forEach(c=>{
          if(c.fromId==='out:'+m.id||c.toId==='out:'+m.id)usadas++;
        });
      });
      doc.setTextColor(40,40,40);
      doc.text((m.nome||m.id).slice(0,42),M+2,y);
      doc.text((pai?(pai.nome||pai.id):'—').slice(0,30),M+80,y);
      doc.text(String(m.portas||4),M+140,y);
      doc.text(String(usadas),M+170,y);
      y+=5;
    });
    y+=4;
  }

  // ─── SEÇÃO 7: CTOs ───
  if(ctos.length){
    sectionTitle('7. CTOs ('+ctos.length+')');
    tableHeader([
      {label:'Nome',x:2},{label:'Poste pai',x:60},{label:'Splitter',x:110},{label:'Portas',x:135},{label:'Clientes',x:160}
    ]);
    ctos.forEach((c,i)=>{
      checkPage(275);zebraRow(i);
      const pai=c.parentId?findById(c.parentId):null;
      const ocup=(c.clientes||[]).filter(cl=>cl.ativo!==false).length;
      doc.setTextColor(40,40,40);
      doc.text((c.nome||c.id).slice(0,32),M+2,y);
      doc.text((pai?(pai.nome||pai.id):'—').slice(0,28),M+60,y);
      doc.text(c.splitter||'—',M+110,y);
      doc.text(String(c.portas||8),M+135,y);
      const isFull=ocup>=(c.portas||8);
      if(isFull){doc.setTextColor(239,68,68);doc.setFont('helvetica','bold');}
      doc.text(ocup+'/'+(c.portas||8),M+160,y);
      doc.setTextColor(40,40,40);doc.setFont('helvetica','normal');
      y+=5;
    });
    y+=4;
  }

  // ─── SEÇÃO 8: Derivações ───
  if(derivs.length){
    sectionTitle('8. Derivações ('+derivs.length+')');
    tableHeader([
      {label:'Nome',x:2},{label:'Poste pai',x:80},{label:'Splitter',x:130},{label:'Capacidade',x:160}
    ]);
    derivs.forEach((d,i)=>{
      checkPage(275);zebraRow(i);
      const pai=d.parentId?findById(d.parentId):null;
      doc.setTextColor(40,40,40);
      doc.text((d.nome||d.id).slice(0,42),M+2,y);
      doc.text((pai?(pai.nome||pai.id):'—').slice(0,28),M+80,y);
      doc.text(d.splitter||'—',M+130,y);
      doc.text(String(d.capacidade||8),M+160,y);
      y+=5;
    });
    y+=4;
  }

  // ─── SEÇÃO 9: Emendas (CEO) ───
  if(emendas.length){
    sectionTitle('9. Emendas Ópticas / CEO ('+emendas.length+')');
    tableHeader([
      {label:'Nome',x:2},{label:'Poste pai',x:80},{label:'Bandejas',x:140}
    ]);
    emendas.forEach((e,i)=>{
      checkPage(275);zebraRow(i);
      const pai=e.parentId?findById(e.parentId):null;
      doc.setTextColor(40,40,40);
      doc.text((e.nome||e.id).slice(0,42),M+2,y);
      doc.text((pai?(pai.nome||pai.id):'—').slice(0,28),M+80,y);
      doc.text(String(e.bandejas||12),M+140,y);
      y+=5;
    });
    y+=4;
  }

  // ─── SEÇÃO 10: Cabos detalhados ───
  if(cabos.length){
    sectionTitle('10. Cabos detalhados ('+cabos.length+')');
    tableHeader([
      {label:'Nome',x:2},{label:'Tipo',x:55},{label:'Dist',x:90},{label:'FOs',x:115},{label:'Atenuação',x:135},{label:'Status',x:170}
    ]);
    cabos.forEach((c,i)=>{
      checkPage(275);zebraRow(i);
      const att=(typeof calcAtt==='function')?calcAtt(c):{tot:0,margin:1000};
      doc.setTextColor(40,40,40);
      doc.text((c.nome||c.id).slice(0,30),M+2,y);
      doc.text((c.typeName||c.typeId||'—').slice(0,18),M+55,y);
      doc.text(_fmtDist(c.dist),M+90,y);
      doc.text(String(c.total||c.grupos*c.fpg||0),M+115,y);
      doc.text(att.tot.toFixed(2)+'dB',M+135,y);
      const stColor=att.margin>=5?[16,185,129]:att.margin>=0?[245,158,11]:[239,68,68];
      doc.setTextColor.apply(doc,stColor);doc.setFont('helvetica','bold');
      doc.text(att.margin>=5?'OK':att.margin>=0?'Limite':'Excede',M+170,y);
      doc.setTextColor(40,40,40);doc.setFont('helvetica','normal');
      y+=5;
    });
  }

  // ─── Rodapé com paginação ───
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    doc.setFontSize(7);doc.setTextColor(150,150,150);
    doc.text('FiberMap Pro · '+_fmtNow()+' · Página '+p+' de '+pages,W/2,H-6,{align:'center'});
  }

  const fname='projeto_completo_'+new Date().toISOString().slice(0,10)+'.pdf';
  doc.save(fname);
  showToast('📄 Relatório completo gerado: '+pages+' páginas','success');
}

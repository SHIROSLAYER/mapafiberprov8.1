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

// ═══════ RELATÓRIO DO PROJETO INTEIRO (resumo) ═══════
function generateProjectReport(){
  const PDF=_getJsPDF();
  if(!PDF){showToast('jsPDF não disponível','error');return;}
  const doc=new PDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210, M=15;
  let y=M;

  // Header
  doc.setFillColor(13,107,80);
  doc.rect(0,0,W,22,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.text('Relatório do Projeto',M,12);
  doc.setFontSize(9);
  doc.setFont('helvetica','normal');
  doc.text('Visão geral consolidada',M,18);
  doc.text(_fmtNow(),W-M,17,{align:'right'});
  y=32;

  // Estatísticas
  const totalCabo=cabos.reduce((s,c)=>s+(c.dist||0),0);
  const stats=[
    ['Armários',armarios.length],
    ['Postes',postes.length],
    ['OLTs',olts.length],
    ['CTOs',ctos.length],
    ['Emendas',emendas.length],
    ['Derivações',derivs.length],
    ['Cabos',cabos.length],
    ['Total cabo',_fmtDist(totalCabo)]
  ];
  doc.setFontSize(13);
  doc.setTextColor(13,107,80);
  doc.setFont('helvetica','bold');
  doc.text('Estatísticas',M,y);y+=8;
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  stats.forEach(([k,v])=>{
    doc.setTextColor(110,110,110);
    doc.text(k,M,y);
    doc.setTextColor(30,30,30);
    doc.setFont('helvetica','bold');
    doc.text(String(v),M+50,y);
    doc.setFont('helvetica','normal');
    y+=5;
  });
  y+=8;

  // Lista de cabos
  if(cabos.length){
    if(y>240){doc.addPage();y=M;}
    doc.setFontSize(13);doc.setTextColor(13,107,80);doc.setFont('helvetica','bold');
    doc.text('Cabos ('+cabos.length+')',M,y);y+=6;
    doc.setFontSize(8);doc.setFont('helvetica','normal');
    doc.setFillColor(40,40,40);doc.rect(M,y,W-2*M,6,'F');
    doc.setTextColor(255,255,255);
    doc.text('Nome',M+2,y+4);doc.text('Tipo',M+50,y+4);doc.text('Dist',M+85,y+4);doc.text('Atenuação',M+110,y+4);doc.text('Status',M+150,y+4);
    y+=8;
    doc.setFont('helvetica','normal');
    cabos.forEach((c,i)=>{
      if(y>275){doc.addPage();y=M;}
      const att=(typeof calcAtt==='function')?calcAtt(c):{tot:0,margin:1000};
      if(i%2===0){doc.setFillColor(248,250,252);doc.rect(M,y-3,W-2*M,5,'F');}
      doc.setTextColor(40,40,40);
      doc.text((c.nome||c.id).slice(0,28),M+2,y);
      doc.text((c.typeName||c.typeId||'—').slice(0,16),M+50,y);
      doc.text(_fmtDist(c.dist),M+85,y);
      doc.text(att.tot.toFixed(2)+' dB',M+110,y);
      const stColor=att.margin>=5?[16,185,129]:att.margin>=0?[245,158,11]:[239,68,68];
      doc.setTextColor.apply(doc,stColor);
      doc.text(att.margin>=5?'OK':att.margin>=0?'Limite':'Excede',M+150,y);
      y+=5;
    });
  }

  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    doc.setFontSize(7);doc.setTextColor(150,150,150);
    doc.text('FiberMap Pro · Pág. '+p+'/'+pages,W/2,290,{align:'center'});
  }
  doc.save('projeto_'+new Date().toISOString().slice(0,10)+'.pdf');
  showToast('📄 Relatório do projeto gerado','success');
}

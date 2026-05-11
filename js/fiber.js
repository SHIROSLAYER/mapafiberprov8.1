// ═══════════════════════════════════════════════
// fiber.js
// ═══════════════════════════════════════════════

function openDiagramInNewTab(elemId){
  var d=findById(elemId);
  if(!d)return;
  if(!d.fibers)d.fibers={connections:[],splitters:[],diagramPositions:{}};
  var near=cablesNear(d);

  // Busca filhos: d.children + parentId nos arrays globais (belt-and-suspenders)
  var seenIds={};
  var allSubElems=[];
  // 1) via d.children
  (d.children||[]).forEach(function(c){
    var s=findById(c.id);
    if(s&&!seenIds[s.id]){seenIds[s.id]=true;allSubElems.push(s);}
  });
  // 2) via parentId em todos os arrays globais
  [].concat(ctos||[],emendas||[],derivs||[],olts||[]).forEach(function(e){
    if(e.parentId===d.id&&!seenIds[e.id]){seenIds[e.id]=true;allSubElems.push(e);}
  });

  if(!near.length&&!allSubElems.length){
    showToast('Nenhum cabo ou sub-elemento vinculado a este elemento','warning');
    // Abre mesmo assim para que o usuário veja o diagrama vazio
  }

  var data={
    elem:{
      id:d.id,nome:d.nome||d.id,tipo:d.tipo,
      children:allSubElems.map(function(s){
        return{id:s.id,nome:s.nome||s.id,tipo:s.tipo,portas:s.portas||s.capacidade||8,splitter:s.splitter||null,bandejas:s.bandejas||12};
      })
    },
    cables:(function(){
      var result=[];
      near.forEach(function(c){
        var base={id:c.id,nome:c.nome||c.id,total:c.total||(c.grupos*(c.fpg||12)),grupos:c.grupos||1,fpg:c.fpg||12,color:c.color||'#1D9E75',typeName:c.typeName||'',dist:c.dist||0};
        var dir=cableDir(d,c);
        if(dir==='passagem'){
          result.push(Object.assign({},base,{dir:'entrada',id:c.id+'::I',nome:base.nome+' — ENTRADA'}));
          result.push(Object.assign({},base,{dir:'saída',id:c.id+'::O',nome:base.nome+' — SAÍDA'}));
        }else{
          result.push(Object.assign({},base,{dir:dir}));
        }
      });
      return result;
    })(),
    connections:(d.fibers.connections||[]).filter(function(c){return c&&c.fromId;}),
    positions:d.fibers.diagramPositions||{},
    abnt:ABNT
  };
  window._fiberDiagramSave=function(conns,pos){
    d.fibers.connections=conns;
    d.fibers.diagramPositions=pos;
    scheduleAutosave();
    stateManager.pushState('Diagrama '+(d.nome||d.id));
  };
  window._diagramData=data;
  console.log('[Diagrama] dados:',data);
  var html;
  try{ html=buildDiagramPage(data); }
  catch(err){
    console.error('[Diagrama] Falha ao construir HTML:',err,data);
    showToast('Erro ao construir diagrama: '+(err.message||err),'error');
    return;
  }
  var w=window.open('','_blank','width=1340,height=860,resizable=yes');
  if(!w){showToast('Pop-up bloqueado — permita pop-ups para este site','error');return;}
  try{
    w.document.open();
    w.document.write(html);
    w.document.close();
  }catch(err){
    console.error('[Diagrama] Falha ao escrever popup:',err);
    showToast('Erro ao abrir popup: '+(err.message||err),'error');
  }
}

function buildDiagramPage(data){
  var nome=(data.elem.nome||data.elem.id).replace(/</g,'&lt;').replace(/`/g,'&#96;');
  var tipo=data.elem.tipo.toUpperCase();
  var encoded=encodeURIComponent(JSON.stringify(data));

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagrama — ${nome}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#fff;font-family:system-ui,"Segoe UI",sans-serif;color:#1a2332}
#tb{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#1a2332;flex-shrink:0;height:44px}
#tb-title{color:#fff;font-weight:700;font-size:13px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tbtn{padding:5px 11px;border-radius:6px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:11px;font-weight:600;transition:background .12s;white-space:nowrap}
.tbtn:hover{background:rgba(255,255,255,.22)}
.tbtn.green{border-color:rgba(29,158,117,.6);background:rgba(29,158,117,.25);color:#6ee7c0}
.tbtn.green:hover{background:rgba(29,158,117,.4)}
.tbtn.red{border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.15);color:#fca5a5}
#area{flex:1;position:relative;overflow:hidden;background-color:#fff;background-image:radial-gradient(circle,#c8d0dc 1.3px,transparent 1.3px);background-size:24px 24px;cursor:grab;user-select:none}
#area.panning{cursor:grabbing}
#inner{position:absolute;top:0;left:0;width:1px;height:1px}
#svg-layer{position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;overflow:visible;z-index:5}
.cpath{fill:none;stroke:#3B82F6;stroke-width:2.4;stroke-dasharray:10 6;stroke-linecap:round;pointer-events:stroke;cursor:pointer;opacity:.85;transition:opacity .15s,stroke .15s,stroke-width .15s;animation:march 1.4s linear infinite}
.cpath:hover{stroke:#60a5fa;opacity:1;stroke-width:3.2}
.cpath.sel{stroke:#F59E0B;stroke-width:4;opacity:1;stroke-dasharray:none;animation:none;filter:drop-shadow(0 0 6px rgba(245,158,11,.7))}
#prev-path{fill:none;stroke:#F59E0B;stroke-width:2.6;stroke-dasharray:8 5;stroke-linecap:round;pointer-events:none;display:none;animation:march 0.7s linear infinite;filter:drop-shadow(0 0 4px rgba(245,158,11,.6))}
@keyframes march{to{stroke-dashoffset:-32}}
@keyframes srcPulse{0%,100%{filter:drop-shadow(0 0 6px #F59E0B) drop-shadow(0 4px 10px rgba(245,158,11,.5))}50%{filter:drop-shadow(0 0 14px #F59E0B) drop-shadow(0 4px 14px rgba(245,158,11,.8))}}
.panel{position:absolute;background:#fff;border-radius:10px;box-shadow:0 3px 18px rgba(0,0,0,.13);border:1.5px solid #e2e8f0;z-index:10;user-select:none;min-width:150px;max-width:290px}
.panel.dragging{box-shadow:0 8px 32px rgba(0,0,0,.2);z-index:20;border-color:#94a3b8}
.phdr{padding:7px 8px;border-radius:8px 8px 0 0;cursor:grab;display:flex;align-items:center;gap:5px;font-weight:700;font-size:11px;color:#fff;touch-action:none;line-height:1.3}
.phdr:active{cursor:grabbing}
.psub{font-size:7.5px;font-weight:400;opacity:.85;background:rgba(0,0,0,.18);border-radius:3px;padding:1px 5px;font-family:monospace;flex-shrink:0}
.premove{background:rgba(0,0,0,.2);border:none;color:#fff;width:18px;height:18px;border-radius:3px;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:.7;line-height:1;padding:0;transition:opacity .1s,background .1s}
.premove:hover{opacity:1;background:rgba(239,68,68,.55)}
.fdot{width:42px;height:20px;cursor:crosshair;transition:transform .12s,filter .12s;flex-shrink:0;display:block;overflow:visible;position:relative;z-index:1}
.fdot .fhx{stroke:rgba(0,0,0,.55);stroke-width:1;transition:stroke .15s,stroke-width .15s}
.fdot:hover:not(.drag-src){transform:scale(1.28);z-index:15;filter:drop-shadow(0 0 4px rgba(59,130,246,.7))}
.fdot:hover:not(.drag-src) .fhx{stroke:#3B82F6;stroke-width:2.5}
.fdot.conn .fhx{stroke:#0d6b50;stroke-width:2.8;filter:drop-shadow(0 0 4px rgba(13,107,80,.7))}
.fdot .fcheck{opacity:0;transition:opacity .15s}
.fdot.conn .fcheck{opacity:1}
.fdot.drag-src{transform:scale(1.42);z-index:30;cursor:grabbing;animation:srcPulse 1s ease-in-out infinite}
.fdot.drag-src .fhx{stroke:#F59E0B;stroke-width:3}
.sarw{flex-shrink:0;pointer-events:none}
.cv-tubo{flex:1;writing-mode:vertical-rl;transform:rotate(180deg);font-weight:700;font-size:8px;font-family:monospace;color:#fff;text-align:center;padding:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.5px}
.cv-tubobar{display:flex;flex-direction:column;align-items:center;justify-content:center;width:20px;min-width:20px;flex-shrink:0;background:#60a917;border-left:1px solid rgba(0,0,0,.2);border-right:1px solid rgba(0,0,0,.2)}
.cto-wrap{display:flex;flex-direction:column;align-items:center;padding-bottom:6px}
.cto-in{padding:7px 8px 3px;display:flex;align-items:center;gap:6px}
.cto-in-lbl{font-size:8px;color:#9ca3af;font-family:monospace}
.cto-stem{width:2px;height:13px;background:#d1d5db}
.cto-bar{width:100%;border-top:2px solid #e5e7eb;padding:6px 8px;display:flex;flex-direction:column;align-items:center;gap:4px}
.cto-bar-lbl{width:100%;font-size:8px;color:#9ca3af;font-family:monospace;text-align:center;margin-bottom:4px;letter-spacing:.5px}
.emenda-info{padding:10px 8px;text-align:center;font-size:9px;color:#6b7280;font-family:monospace;line-height:1.7}
#sb{height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#fff;border-top:1px solid #e5e7eb;font-size:10px;font-family:monospace;color:#6b7280;flex-shrink:0}
#sb-msg{color:#0d6b50;font-weight:600}
#tip{position:fixed;background:#1a2332;border:1px solid #374151;border-radius:8px;padding:7px 11px;font-size:10px;font-family:monospace;color:#e2e8f0;pointer-events:none;z-index:9999;opacity:0;transition:opacity .1s;max-width:230px;line-height:1.75;white-space:pre-line;box-shadow:0 4px 16px rgba(0,0,0,.3)}
#tip.on{opacity:1}
#empty-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;font-family:system-ui,"Segoe UI",sans-serif;color:#6b7280;pointer-events:none;max-width:480px;padding:24px}
#empty-msg h3{font-size:18px;font-weight:700;color:#1a2332;margin-bottom:10px}
#empty-msg p{font-size:13px;line-height:1.7;margin-bottom:6px}
#empty-msg .hint{font-size:11px;color:#9ca3af;margin-top:14px;font-family:monospace}
#err-box{position:absolute;top:20px;left:20px;right:20px;background:#fee;border:2px solid #c00;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;color:#900;z-index:9999;white-space:pre-wrap;max-height:60vh;overflow:auto;display:none}
.cv-panel{max-width:none!important}
.cv-lbar{flex-direction:column!important;align-items:center!important;justify-content:space-between!important;border-radius:0!important;gap:0!important;padding:8px 0 6px!important}
.cv-ltxt{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:700;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;text-align:center;padding:2px 0;color:#fff;cursor:grab}
</style>
</head>
<body style="display:flex;flex-direction:column;height:100%">
<div id="tb">
  <span id="tb-title">${nome} <span style="font-size:9px;background:rgba(255,255,255,.15);border-radius:4px;padding:1px 6px;font-family:monospace;font-weight:400">${tipo}</span></span>
  <button class="tbtn green" id="btn-save" onclick="doSave()">&#x1F4BE; Salvar</button>
  <button class="tbtn red" id="btn-remove-conn" style="display:none" onclick="removeSelectedConn()">&#x2715; Remover liga&ccedil;&atilde;o</button>
  <button class="tbtn" onclick="resetLayout()">&#8635; Layout</button>
  <button class="tbtn red" onclick="clearConns()">&#x2715; Limpar</button>
  <button class="tbtn" onclick="window.close()">Fechar</button>
</div>
<div id="area">
  <div id="inner">
    <svg id="svg-layer">
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0L8,4L0,8Z" fill="#3B82F6" opacity=".85"/>
        </marker>
      </defs>
      <path id="prev-path"/>
    </svg>
  </div>
</div>
<div id="sb"><span id="sb-msg">Arraste o fundo para navegar · Arraste fibras para conectar</span><span id="sb-cnt">0 conexões</span></div>
<div id="tip"></div>
<div id="err-box"></div>
<script type="application/json" id="ddata">${encoded}</script>
<script>
window.addEventListener('error',function(e){
  var box=document.getElementById('err-box');
  if(!box)return;
  box.style.display='block';
  box.textContent='⚠ Erro: '+(e.message||e.error||'desconhecido')+'\\n\\nLinha: '+(e.lineno||'?')+' · Coluna: '+(e.colno||'?')+'\\n\\nAbra DevTools (F12) e reporte este erro.';
});
var DATA=null;
try{
  DATA=(window.opener&&window.opener._diagramData)||null;
  if(!DATA){
    var raw=document.getElementById('ddata').textContent;
    DATA=JSON.parse(decodeURIComponent(raw));
  }
}catch(e){
  console.error('Falha ao carregar dados:',e);
  document.body.innerHTML='<div style="padding:40px;font-family:monospace;color:#c00;font-size:14px"><strong>Erro ao carregar dados do diagrama:</strong><br><br>'+(e.message||e)+'<br><br>Feche e tente novamente. Se persistir, abra DevTools (F12) e reporte.</div>';
  throw e;
}
if(!DATA){document.body.innerHTML='<div style="padding:40px;font-family:monospace;color:#c00;font-size:14px">Erro: dados não encontrados. Feche e abra novamente.</div>';throw new Error('no data');}
console.log('[Popup] DATA carregado:',DATA);
var ABNT=DATA.abnt;
var ELEM=DATA.elem;
var CABLES=DATA.cables;
var connections=DATA.connections.slice();
var positions=(function(){var p=DATA.positions,r={};for(var k in p)r[k]={x:p[k].x,y:p[k].y};return r;})();
var panelDom={};
var _saved=true;
var panX=0,panY=0,panning=null;

function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function isConn(eid,fi){return connections.some(function(c){return(c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi);});}
function getConn(eid,fi){return connections.find(function(c){return(c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi);});}
function lightness(hex){var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return(r*299+g*587+b*114)/1000;}

// ── Pan (arrastar fundo) ─────────────────────────────────────────
function applyPan(x,y){
  panX=x;panY=y;
  document.getElementById('inner').style.transform='translate('+x+'px,'+y+'px)';
  var a=document.getElementById('area');
  a.style.backgroundPosition=(((x%24)+24)%24)+'px '+(((y%24)+24)%24)+'px';
}

var area=document.getElementById('area');
area.addEventListener('mousedown',function(e){
  if(e.button!==0||panning||pdrag||fdrag)return;
  if(e.target.closest&&e.target.closest('.panel,.fdot,.cpath'))return;
  if(selectedConnIdx>=0)selectConn(-1);
  e.preventDefault();
  panning={sx:e.clientX-panX,sy:e.clientY-panY};
  area.classList.add('panning');
});
area.addEventListener('touchstart',function(e){
  if(e.touches.length!==1||pdrag||fdrag)return;
  if(e.target.closest&&e.target.closest('.panel,.fdot'))return;
  var t=e.touches[0];
  panning={sx:t.clientX-panX,sy:t.clientY-panY};
},{passive:true});

// ── Remove panel ────────────────────────────────────────────────
function removeFromCanvas(pid){
  if(!panelDom[pid])return;
  var eids=[];
  if(pid.indexOf('cable:')===0){eids=[pid];}
  else if(pid.indexOf('child:')===0){var sid=pid.slice(6);eids=['in:'+sid,'out:'+sid];}
  connections=connections.filter(function(c){return eids.indexOf(c.fromId)<0&&eids.indexOf(c.toId)<0;});
  panelDom[pid].remove();delete panelDom[pid];delete positions[pid];
  markUnsaved();updateAll();
}

// ── Build cable panel ───────────────────────────────────────────
function buildCablePanel(c){
  var pid='cable:'+c.id;
  var isE=(c.dir==='entrada');
  var dirL=isE?'ENTRADA':'SA\xCDDA';
  var div=document.createElement('div');
  div.dataset.pid=pid;

  // Cabeçalho (faixa azul escura com nome + ENTRADA/SAÍDA)
  function buildLbar(){
    var lb=document.createElement('div');
    lb.className='phdr cv-lbar';
    lb.style.cssText='width:22px;min-width:22px;flex-shrink:0;background:#182e3e;';
    var lt=document.createElement('span');
    lt.className='cv-ltxt';lt.textContent=(c.nome||c.id)+' — '+dirL;lt.title=(c.nome||c.id);
    lb.appendChild(lt);
    return lb;
  }

  // ── Multi-tubo ────────────────────────────────────────────────────
  if(c.grupos>1){
    var FH=30,TH=18;
    var totalH=c.grupos*(TH+c.fpg*FH)+20;
    div.className='panel cv-panel';
    div.style.cssText='width:128px;display:flex;flex-direction:'+(isE?'row':'row-reverse')+';min-height:'+totalH+'px;border-radius:8px;overflow:hidden;';
    div.appendChild(buildLbar());
    var bdy2=document.createElement('div');
    bdy2.style.cssText='width:106px;flex-shrink:0;position:relative;background:#f8fafc;';
    var tb2=document.createElement('div');
    tb2.style.cssText='position:absolute;top:0;bottom:0;width:14px;background:#808080;border:1px solid #555;z-index:0;'+(isE?'left:6px':'right:6px');
    bdy2.appendChild(tb2);
    for(var g=0;g<c.grupos;g++){
      var tc=ABNT[g%12];
      var tr=parseInt(tc.hex.slice(1,3),16),tg=parseInt(tc.hex.slice(3,5),16),tb3=parseInt(tc.hex.slice(5,7),16);
      var bright=(tr*299+tg*587+tb3*114)/1000;
      var thdr=document.createElement('div');
      thdr.style.cssText='display:flex;align-items:center;justify-content:center;height:'+TH+'px;position:relative;z-index:2;background:'+tc.hex+';padding:0 6px;font-size:8px;font-weight:700;font-family:monospace;letter-spacing:.4px;color:'+(bright>160?'#000':'#fff')+';';
      thdr.textContent='TUBOLOSE:'+('0'+(g+1)).slice(-2)+' · '+tc.name.toUpperCase();
      bdy2.appendChild(thdr);
      for(var f2=0;f2<c.fpg;f2++){
        var fi2=g*c.fpg+f2;
        var fc2=ABNT[f2%12];
        var row2=document.createElement('div');
        row2.style.cssText='display:flex;align-items:center;height:'+FH+'px;position:relative;z-index:1;gap:2px;padding:0 4px;'+(isE?'justify-content:flex-end;':'justify-content:flex-start;');
        var dot2=makeDot(pid,fi2,fc2.hex,f2+1,'Cabo '+escH(c.nome||c.id)+' — T'+(g+1)+' F'+(f2+1),isE?'R':'L');
        if(isConn(pid,fi2))dot2.classList.add('conn');
        var arw2=makeArw(isE);
        arw2.setAttribute('width','14');arw2.setAttribute('height','22');
        if(isE){row2.appendChild(dot2);row2.appendChild(arw2);}else{row2.appendChild(arw2);row2.appendChild(dot2);}
        bdy2.appendChild(row2);
      }
    }
    div.appendChild(bdy2);
    return div;
  }

  // ── Tubo único (1 grupo) — faixa verde TUBOLOSE estilo mockup ────
  var FH=40;
  var tuboColor=ABNT[0]; // tubo 1 = verde no padrão ABNT/EIA
  var panelH=c.fpg*FH+40;
  div.className='panel cv-panel';
  div.style.cssText='width:148px;display:flex;flex-direction:'+(isE?'row':'row-reverse')+';min-height:'+panelH+'px;border-radius:8px;overflow:hidden;';
  div.appendChild(buildLbar());
  // Faixa verde TUBOLOSE (rotacionada, ao lado do cabeçalho azul)
  var tubobar=document.createElement('div');
  tubobar.className='cv-tubobar';
  tubobar.style.background=tuboColor.hex;
  var tubotxt=document.createElement('span');
  tubotxt.className='cv-tubo';
  var trc=parseInt(tuboColor.hex.slice(1,3),16),tgc=parseInt(tuboColor.hex.slice(3,5),16),tbc=parseInt(tuboColor.hex.slice(5,7),16);
  var bright=(trc*299+tgc*587+tbc*114)/1000;
  tubotxt.style.color=bright>160?'#000':'#fff';
  tubotxt.textContent='TUBOLOSE:01 · '+tuboColor.name.toUpperCase();
  tubobar.appendChild(tubotxt);
  div.appendChild(tubobar);
  var bdy=document.createElement('div');
  bdy.style.cssText='width:106px;flex-shrink:0;position:relative;background:#f8fafc;';
  var tb=document.createElement('div');
  tb.style.cssText='position:absolute;top:0;bottom:0;width:14px;background:#808080;border:1px solid #555;z-index:0;'+(isE?'left:6px':'right:6px');
  bdy.appendChild(tb);
  for(var f=0;f<c.fpg;f++){
    var fi=f,fc=ABNT[f%12];
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;height:'+FH+'px;position:relative;z-index:1;gap:3px;padding:0 4px;'+(isE?'justify-content:flex-end;':'justify-content:flex-start;');
    var dot=makeDot(pid,fi,fc.hex,f+1,'Cabo '+escH(c.nome||c.id)+' — F'+(f+1),isE?'R':'L');
    if(isConn(pid,fi))dot.classList.add('conn');
    var arw=makeArw(isE);
    if(isE){row.appendChild(dot);row.appendChild(arw);}else{row.appendChild(arw);row.appendChild(dot);}
    bdy.appendChild(row);
  }
  div.appendChild(bdy);
  return div;
}

// ── Build child panel ───────────────────────────────────────────
function buildChildPanel(s){
  var COL={cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',olt:'#06B6D4'};
  var TIPO={cto:'CTO',emenda:'Emenda',deriv:'Derivação',olt:'OLT'};
  var sc=COL[s.tipo]||'#888';
  var rawNome=s.nome||s.id;
  var tipoLbl=TIPO[s.tipo]||s.tipo.toUpperCase();
  // Para tooltip: sempre prefixa o tipo pra evitar confusão com "cabo 01"
  var fullLabel=tipoLbl+' '+rawNome;
  // Para header do painel (espaço limitado)
  var snome=rawNome.length<26?rawNome:(tipoLbl+' '+s.id.slice(-4));
  var smeta=s.splitter?s.splitter:s.tipo==='emenda'?(s.bandejas||12)+' band.':(s.portas||8)+' portas';
  var div=document.createElement('div');div.className='panel';div.dataset.pid='child:'+s.id;
  var hdr=makePanelHdr(snome,smeta,sc,'child:'+s.id);div.appendChild(hdr);
  if(s.tipo==='emenda'){
    var info=document.createElement('div');info.className='emenda-info';
    info.innerHTML='Emenda óptica<br><span style="opacity:.7">conecte fibras<br>entrada → saída</span>';
    div.appendChild(info);
  }else{
    var ports=s.portas||s.capacidade||8;
    var wrap=document.createElement('div');wrap.className='cto-wrap';
    var inDiv=document.createElement('div');inDiv.className='cto-in';
    var inLbl=document.createElement('span');inLbl.className='cto-in-lbl';inLbl.textContent='ENTRADA';
    var inDot=makeDot('in:'+s.id,0,sc,'▶',escH(fullLabel)+' — entrada');
    if(isConn('in:'+s.id,0))inDot.classList.add('conn');
    inDiv.appendChild(inLbl);inDiv.appendChild(inDot);
    var stem=document.createElement('div');stem.className='cto-stem';
    var bar=document.createElement('div');bar.className='cto-bar';
    var barLbl=document.createElement('div');barLbl.className='cto-bar-lbl';barLbl.textContent='SA\xCDDAS';
    bar.appendChild(barLbl);
    for(var p=0;p<ports;p++){
      var pd=makeDot('out:'+s.id,p,sc,p+1,escH(fullLabel)+' — porta '+(p+1));
      if(isConn('out:'+s.id,p))pd.classList.add('conn');
      bar.appendChild(pd);
    }
    wrap.appendChild(inDiv);wrap.appendChild(stem);wrap.appendChild(bar);div.appendChild(wrap);
  }
  return div;
}

function makePanelHdr(name,sub,color,pid){
  var hdr=document.createElement('div');hdr.className='phdr';hdr.style.background=color;
  var span=document.createElement('span');span.style.cssText='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';span.textContent=name;
  var badge=document.createElement('span');badge.className='psub';badge.textContent=sub;
  hdr.appendChild(span);hdr.appendChild(badge);return hdr;
}

var SVG_NS='http://www.w3.org/2000/svg';
function makeDot(eid,fi,color,label,title,tipSide){
  // tipSide: 'L' = número à esquerda (ponta esquerda) | 'R' = número à direita | null = centrado
  var svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('class','fdot');
  svg.setAttribute('viewBox','0 0 50 20');
  svg.dataset.eid=eid;svg.dataset.fi=fi;svg.dataset.dotTitle=title;
  var p=document.createElementNS(SVG_NS,'path');
  p.setAttribute('class','fhx');
  // Hexágono alongado e mais fino, com pontas marcadas
  p.setAttribute('d','M8 1 L42 1 L49 10 L42 19 L8 19 L1 10 Z');
  p.setAttribute('fill',color);
  svg.appendChild(p);
  var t=document.createElementNS(SVG_NS,'text');
  var tx=tipSide==='R'?38:tipSide==='L'?12:25;
  t.setAttribute('x',String(tx));t.setAttribute('y','10');
  t.setAttribute('text-anchor','middle');
  t.setAttribute('dominant-baseline','central');
  t.setAttribute('font-size','11');t.setAttribute('font-weight','800');
  t.setAttribute('font-family','Helvetica,Arial,sans-serif');
  t.setAttribute('fill',lightness(color)>160?'#000':'#fff');
  t.setAttribute('pointer-events','none');
  t.textContent=label;
  svg.appendChild(t);
  // Badge "✓" verde no canto oposto à ponta — mostra que está conectado
  var checkG=document.createElementNS(SVG_NS,'g');
  checkG.setAttribute('class','fcheck');
  checkG.setAttribute('pointer-events','none');
  var cx=tipSide==='R'?6:tipSide==='L'?44:44;
  var cc=document.createElementNS(SVG_NS,'circle');
  cc.setAttribute('cx',String(cx));cc.setAttribute('cy','3');cc.setAttribute('r','3');
  cc.setAttribute('fill','#10B981');cc.setAttribute('stroke','#fff');cc.setAttribute('stroke-width','0.8');
  checkG.appendChild(cc);
  svg.appendChild(checkG);
  bindFiberDot(svg);return svg;
}
function makeArw(isE){
  var svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('class','sarw');
  svg.setAttribute('viewBox','0 0 20 30');
  svg.setAttribute('width','18');svg.setAttribute('height','27');
  var p=document.createElementNS(SVG_NS,'path');
  // Teardrop com entalhe — réplica do mockup SVG (path original do draw.io)
  p.setAttribute('d',isE
    ?'M 1 3 L 11 3 Q -9 15 11 27 L 1 27 Q -19 15 1 3 Z'
    :'M 19 3 L 9 3 Q 29 15 9 27 L 19 27 Q 39 15 19 3 Z');
  p.setAttribute('fill','#182e3e');
  p.setAttribute('stroke','#fff');p.setAttribute('stroke-width','0.6');
  svg.appendChild(p);
  return svg;
}

// ── Place all elements (auto-layout) ────────────────────────────
function placeAll(){
  var inner=document.getElementById('inner');
  Object.keys(panelDom).forEach(function(k){panelDom[k].remove();});
  panelDom={};positions={};
  var FH=40,TH=18,GAP=28;
  var colE=60,colS=380,colC=620;
  var yE=80,yS=80,yC=80;
  CABLES.forEach(function(c){
    var pid='cable:'+c.id;
    var isE=(c.dir==='entrada');
    var x=isE?colE:colS;
    var yRef=isE?yE:yS;
    var p=buildCablePanel(c);
    p.style.left=x+'px';p.style.top=yRef+'px';
    positions[pid]={x:x,y:yRef};
    inner.appendChild(p);panelDom[pid]=p;bindPanelDrag(p,pid);
    var h=c.grupos>1?c.grupos*(TH+c.fpg*30)+20:c.fpg*FH+40;
    if(isE)yE+=h+GAP;else yS+=h+GAP;
  });
  ELEM.children.forEach(function(s){
    var pid='child:'+s.id;
    var p=buildChildPanel(s);
    p.style.left=colC+'px';p.style.top=yC+'px';
    positions[pid]={x:colC,y:yC};
    inner.appendChild(p);panelDom[pid]=p;bindPanelDrag(p,pid);
    var ports=s.portas||s.capacidade||8;
    var h=s.tipo==='emenda'?100:ports*30+80;
    yC+=h+GAP;
  });
  applyPan(0,0);
}

// ── Panel drag ──────────────────────────────────────────────────
var pdrag=null;
function bindPanelDrag(panel,pid){
  var hdr=panel.querySelector('.phdr');
  function start(cx,cy){
    var pr=panel.getBoundingClientRect();
    pdrag={panel:panel,pid:pid,ox:cx-pr.left,oy:cy-pr.top};
    panel.classList.add('dragging');
  }
  hdr.addEventListener('mousedown',function(e){if(e.button!==0)return;e.preventDefault();e.stopPropagation();start(e.clientX,e.clientY);});
  hdr.addEventListener('touchstart',function(e){if(e.touches.length!==1)return;e.preventDefault();e.stopPropagation();var t=e.touches[0];start(t.clientX,t.clientY);},{passive:false});
}

// ── Fiber drag ──────────────────────────────────────────────────
var fdrag=null;
function bindFiberDot(dot){
  dot.addEventListener('mousedown',function(e){
    if(e.button!==0||pdrag)return;
    e.preventDefault();e.stopPropagation();
    fdrag={eid:dot.dataset.eid,fi:parseInt(dot.dataset.fi),el:dot,moved:false};
    dot.classList.add('drag-src');showTip(dot,e.clientX,e.clientY);
  });
  dot.addEventListener('mousemove',function(e){if(!fdrag)showTip(dot,e.clientX,e.clientY);});
  dot.addEventListener('mouseleave',function(){if(!fdrag)hideTip();});
  dot.addEventListener('touchstart',function(e){
    if(e.touches.length!==1||pdrag)return;e.preventDefault();e.stopPropagation();
    var t=e.touches[0];fdrag={eid:dot.dataset.eid,fi:parseInt(dot.dataset.fi),el:dot,moved:false};
    dot.classList.add('drag-src');showTip(dot,t.clientX,t.clientY);
  },{passive:false});
  dot.addEventListener('touchmove',function(e){
    if(!fdrag||e.touches.length!==1)return;e.preventDefault();
    fdrag.moved=true;var t=e.touches[0];updatePreview(t.clientX,t.clientY);
  },{passive:false});
  dot.addEventListener('touchend',function(e){
    if(!fdrag)return;e.preventDefault();
    var t=e.changedTouches[0];
    var tgt=document.elementFromPoint(t.clientX,t.clientY);
    var hit=tgt&&tgt.closest?tgt.closest('.fdot'):null;
    finishFiber(hit||null);
  },{passive:false});
}

// ── Unified move / up ───────────────────────────────────────────
document.addEventListener('mousemove',function(e){
  if(panning){applyPan(e.clientX-panning.sx,e.clientY-panning.sy);return;}
  if(fdrag){updatePreview(e.clientX,e.clientY);return;}
  if(!pdrag)return;
  movePanel(pdrag,e.clientX,e.clientY);
});
document.addEventListener('mouseup',function(e){
  if(panning){panning=null;area.classList.remove('panning');return;}
  if(fdrag){var t=document.elementFromPoint(e.clientX,e.clientY);var hit=t&&t.closest?t.closest('.fdot'):null;finishFiber(hit||null);return;}
  if(pdrag){pdrag.panel.classList.remove('dragging');pdrag=null;markUnsaved();}
});
document.addEventListener('touchmove',function(e){
  if(panning){var t=e.touches[0];applyPan(t.clientX-panning.sx,t.clientY-panning.sy);return;}
  if(!pdrag)return;e.preventDefault();
  var t=e.touches[0];movePanel(pdrag,t.clientX,t.clientY);
},{passive:false});
document.addEventListener('touchend',function(){
  if(panning){panning=null;return;}
  if(pdrag){pdrag.panel.classList.remove('dragging');pdrag=null;markUnsaved();}
});

function panelOverlaps(panel,x,y){
  var w=panel.offsetWidth,h=panel.offsetHeight;
  var PAD=4; // margem mínima entre painéis
  for(var pid in panelDom){
    var other=panelDom[pid];
    if(other===panel)continue;
    var pos=positions[pid];if(!pos)continue;
    var ow=other.offsetWidth,oh=other.offsetHeight;
    var noOverlap=(x+w+PAD<=pos.x)||(pos.x+ow+PAD<=x)||(y+h+PAD<=pos.y)||(pos.y+oh+PAD<=y);
    if(!noOverlap)return true;
  }
  return false;
}
function movePanel(drag,cx,cy){
  var ir=document.getElementById('inner').getBoundingClientRect();
  var nx=Math.max(0,cx-ir.left-drag.ox);
  var ny=Math.max(0,cy-ir.top-drag.oy);
  var cur=positions[drag.pid]||{x:nx,y:ny};
  // Permite deslizar nas bordas: testa X e Y separados
  var tryX=panelOverlaps(drag.panel,nx,cur.y)?cur.x:nx;
  var tryY=panelOverlaps(drag.panel,tryX,ny)?cur.y:ny;
  drag.panel.style.left=tryX+'px';drag.panel.style.top=tryY+'px';
  positions[drag.pid]={x:tryX,y:tryY};drawSVG();
}

function updatePreview(cx,cy){
  if(!fdrag)return;fdrag.moved=true;
  var ir=document.getElementById('inner').getBoundingClientRect();
  var fr=fdrag.el.getBoundingClientRect();
  var x1=fr.left-ir.left+fr.width/2,y1=fr.top-ir.top+fr.height/2;
  var x2=cx-ir.left,y2=cy-ir.top;
  var mx=(x1+x2)/2;
  var prev=document.getElementById('prev-path');
  prev.setAttribute('d','M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2);
  prev.style.display='inline';
}
function clearPreview(){var p=document.getElementById('prev-path');if(p)p.style.display='none';}

function finishFiber(targetDot){
  if(!fdrag)return;
  var src=fdrag;fdrag=null;
  src.el.classList.remove('drag-src');clearPreview();hideTip();
  if(!targetDot||targetDot===src.el){
    if(!src.moved&&isConn(src.eid,src.fi)){
      var ci=connections.findIndex(function(c){return(c.fromId===src.eid&&c.fromFi===src.fi)||(c.toId===src.eid&&c.toFi===src.fi);});
      if(ci>=0){connections.splice(ci,1);markUnsaved();updateAll();sbMsg('Conexão removida');}
    }
    return;
  }
  var tEid=targetDot.dataset.eid,tFi=parseInt(targetDot.dataset.fi);
  if(src.eid===tEid&&src.fi===tFi)return;
  // Conexão já existe entre essas duas fibras? → toggle remove
  var ex=connections.findIndex(function(c){
    return(c.fromId===src.eid&&c.fromFi===src.fi&&c.toId===tEid&&c.toFi===tFi)||
           (c.fromId===tEid&&c.fromFi===tFi&&c.toId===src.eid&&c.toFi===src.fi);
  });
  if(ex>=0){connections.splice(ex,1);sbMsg('Conexão removida');markUnsaved();updateAll();return;}
  // REGRA: cada fibra só pode ter UMA conexão
  if(isConn(src.eid,src.fi)){
    sbMsg('⚠ Fibra de origem já está conectada — remova a ligação existente antes');
    return;
  }
  if(isConn(tEid,tFi)){
    sbMsg('⚠ Fibra de destino já está conectada — remova a ligação existente antes');
    return;
  }
  connections.push({fromId:src.eid,fromFi:src.fi,toId:tEid,toFi:tFi});
  sbMsg('✓ Fibras conectadas');
  markUnsaved();updateAll();
}

// ── SVG ──────────────────────────────────────────────────────────
function getDotPos(dot){
  var ir=document.getElementById('inner').getBoundingClientRect();
  var dr=dot.getBoundingClientRect();
  return{x:dr.left-ir.left+dr.width/2,y:dr.top-ir.top+dr.height/2};
}
var selectedConnIdx=-1;
function selectConn(idx){
  selectedConnIdx=idx;
  var btn=document.getElementById('btn-remove-conn');
  if(btn)btn.style.display=idx>=0?'':'none';
  var paths=document.querySelectorAll('.cpath');
  paths.forEach(function(p,i){p.classList.toggle('sel',i===idx);});
  if(idx>=0){
    var c=connections[idx];
    var fe=document.querySelector('.fdot[data-eid="'+c.fromId+'"][data-fi="'+c.fromFi+'"]');
    var te=document.querySelector('.fdot[data-eid="'+c.toId+'"][data-fi="'+c.toFi+'"]');
    var fT=fe?fe.dataset.dotTitle:c.fromId+'#'+c.fromFi;
    var tT=te?te.dataset.dotTitle:c.toId+'#'+c.toFi;
    sbMsg('Ligação selecionada: '+fT+'  →  '+tT);
  }else{
    sbMsg('Arraste fibras para conectar');
  }
}
function removeSelectedConn(){
  if(selectedConnIdx<0)return;
  connections.splice(selectedConnIdx,1);
  selectConn(-1);
  markUnsaved();updateAll();sbMsg('Ligação removida');
}
function drawSVG(){
  var svg=document.getElementById('svg-layer');
  svg.querySelectorAll('.cpath,.cendp').forEach(function(p){p.remove();});
  var prev=document.getElementById('prev-path');
  if(selectedConnIdx>=connections.length)selectedConnIdx=-1;
  connections.forEach(function(conn,i){
    var fe=document.querySelector('.fdot[data-eid="'+conn.fromId+'"][data-fi="'+conn.fromFi+'"]');
    var te=document.querySelector('.fdot[data-eid="'+conn.toId+'"][data-fi="'+conn.toFi+'"]');
    if(!fe||!te)return;
    var fp=getDotPos(fe),tp=getDotPos(te);
    var mx=(fp.x+tp.x)/2;
    var fpath=fe.querySelector('.fhx');
    var tpath=te.querySelector('.fhx');
    var fColor=fpath?fpath.getAttribute('fill'):'#3B82F6';
    var tColor=tpath?tpath.getAttribute('fill'):'#3B82F6';
    var path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('class','cpath'+(i===selectedConnIdx?' sel':''));
    path.setAttribute('d','M'+fp.x+','+fp.y+' C'+mx+','+fp.y+' '+mx+','+tp.y+' '+tp.x+','+tp.y);
    if(i!==selectedConnIdx)path.setAttribute('stroke',fColor);
    path.addEventListener('click',(function(idx){return function(e){e.stopPropagation();selectConn(idx===selectedConnIdx?-1:idx);};})(i));
    svg.insertBefore(path,prev);
    // Marcadores de endpoint — círculos coloridos nas pontas, deixam claro qual fibra
    [{x:fp.x,y:fp.y,c:fColor},{x:tp.x,y:tp.y,c:tColor}].forEach(function(e){
      var ep=document.createElementNS('http://www.w3.org/2000/svg','circle');
      ep.setAttribute('class','cendp');
      ep.setAttribute('cx',e.x);ep.setAttribute('cy',e.y);ep.setAttribute('r','4');
      ep.setAttribute('fill',e.c);ep.setAttribute('stroke','#fff');ep.setAttribute('stroke-width','1.5');
      ep.setAttribute('pointer-events','none');
      svg.insertBefore(ep,prev);
    });
  });
  document.getElementById('sb-cnt').textContent=connections.length+(connections.length===1?' conexão':' conexões');
  var btn=document.getElementById('btn-remove-conn');
  if(btn)btn.style.display=selectedConnIdx>=0?'':'none';
}
function updateDots(){document.querySelectorAll('.fdot').forEach(function(dot){dot.classList.toggle('conn',isConn(dot.dataset.eid,parseInt(dot.dataset.fi)));});}
function updateAll(){updateDots();drawSVG();}

// ── Tooltip ──────────────────────────────────────────────────────
function showTip(dot,cx,cy){
  var tip=document.getElementById('tip');
  var conn=getConn(dot.dataset.eid,parseInt(dot.dataset.fi));
  var lines=['<strong>'+dot.dataset.dotTitle+'</strong>'];
  if(conn){
    var oid=conn.fromId===dot.dataset.eid&&conn.fromFi===parseInt(dot.dataset.fi)?conn.toId:conn.fromId;
    var ofi=conn.fromId===dot.dataset.eid&&conn.fromFi===parseInt(dot.dataset.fi)?conn.toFi:conn.fromFi;
    var od=document.querySelector('.fdot[data-eid="'+oid+'"][data-fi="'+ofi+'"]');
    lines.push('<span style="color:#1D9E75">⇔ '+(od?od.dataset.dotTitle:oid+'#'+ofi)+'</span>');
  }else{lines.push('<span style="color:#9ca3af">Dispon\xEDvel</span>');}
  tip.innerHTML=lines.join('<br>');tip.classList.add('on');
  tip.style.left=Math.min(cx+14,window.innerWidth-240)+'px';
  tip.style.top=Math.min(cy-10,window.innerHeight-80)+'px';
}
function hideTip(){document.getElementById('tip').classList.remove('on');}

// ── Save / misc ──────────────────────────────────────────────────
function sbMsg(msg){document.getElementById('sb-msg').textContent=msg;}
function markUnsaved(){
  _saved=false;
  var btn=document.getElementById('btn-save');
  btn.textContent='💾 Salvar *';
}
function doSave(){
  if(window.opener&&window.opener._fiberDiagramSave)
    window.opener._fiberDiagramSave(connections.slice(),(function(){var r={};for(var k in positions)r[k]={x:positions[k].x,y:positions[k].y};return r;})());
  _saved=true;
  var btn=document.getElementById('btn-save');btn.textContent='✓ Salvo!';
  setTimeout(function(){btn.textContent='💾 Salvar';},2000);
  sbMsg('Diagrama salvo');
}
function resetLayout(){placeAll();markUnsaved();updateAll();sbMsg('Layout reiniciado');}
function clearConns(){
  if(!confirm('Limpar todas as conex\xF5es?'))return;
  connections=[];markUnsaved();updateAll();sbMsg('Conex\xF5es limpas');
}
var _rsz;window.addEventListener('resize',function(){clearTimeout(_rsz);_rsz=setTimeout(updateAll,150);});

// ── Init ──────────────────────────────────────────────────────────
(function(){
  var inner=document.getElementById('inner');
  var hasSaved=Object.keys(positions).length>0;
  if(hasSaved){
    CABLES.forEach(function(c){
      var pid='cable:'+c.id;if(!positions[pid])return;
      var p=buildCablePanel(c);
      p.style.left=positions[pid].x+'px';p.style.top=positions[pid].y+'px';
      inner.appendChild(p);panelDom[pid]=p;bindPanelDrag(p,pid);
    });
    ELEM.children.forEach(function(s){
      var pid='child:'+s.id;if(!positions[pid])return;
      var p=buildChildPanel(s);
      p.style.left=positions[pid].x+'px';p.style.top=positions[pid].y+'px';
      inner.appendChild(p);panelDom[pid]=p;bindPanelDrag(p,pid);
    });
    applyPan(0,0);updateAll();
  }else{
    placeAll();
    if(CABLES.length||ELEM.children.length)
      sbMsg(CABLES.length+' cabo(s) · '+ELEM.children.length+' elemento(s) — Arraste o fundo para navegar · Arraste fibras para conectar');
    else
      sbMsg('Nenhum cabo ou elemento vinculado — vincule cabos e adicione Emenda ao poste');
  }
  if(!CABLES.length&&!ELEM.children.length){
    var em=document.createElement('div');
    em.id='empty-msg';
    var tipoLabel=(ELEM.tipo||'').toLowerCase();
    var dica=tipoLabel==='poste'
      ?'Este poste ainda não tem <strong>cabos ancorados</strong> nem <strong>emendas</strong> vinculadas.<br>Volte ao mapa e:<br>1) trace um cabo passando/terminando neste poste<br>2) adicione uma Emenda óptica vinculada a este poste'
      :tipoLabel==='armario'
      ?'Este armário ainda não tem <strong>cabos ancorados</strong> nem <strong>elementos</strong> vinculados (CTO/Emenda/Derivação/OLT).<br>Volte ao mapa e trace cabos ancorados aqui, ou adicione elementos filhos.'
      :'Este elemento ainda não tem cabos ou sub-elementos vinculados.';
    em.innerHTML='<h3>📭 Diagrama vazio</h3><p>'+dica+'</p><p class="hint">'+(ELEM.nome||ELEM.id)+' · '+(ELEM.tipo||'?').toUpperCase()+'</p>';
    document.getElementById('area').appendChild(em);
  }
  updateAll();
})();
<\/script>
</body>
</html>`;
}

// ══ FUNÇÕES DO MODAL ════════════════════════════════════════════
function switchEmTab(i){
  document.querySelectorAll('.em-tab').forEach(function(t,j){t.classList.toggle('act',i===j);});
  document.querySelectorAll('.etc').forEach(function(t,j){t.classList.toggle('act',i===j);});
}
function closeEmModal(){document.getElementById('em-overlay').classList.remove('show');currentEM=null;}

function saveProps(){
  var d=currentEM;if(!d)return;
  var n=document.getElementById('pi-nome');if(n)d.nome=n.value;
  var o=document.getElementById('pi-obs');if(o)d.obs=o.value;
  if(d.tipo==='armario'){var e=document.getElementById('pi-capacidade');if(e)d.capacidade=parseInt(e.value)||24;}
  if(d.tipo==='olt'){var e2=document.getElementById('pi-portas');if(e2)d.portas=parseInt(e2.value)||16;}
  if(d.tipo==='cto'){var e3=document.getElementById('pi-portas');if(e3)d.portas=parseInt(e3.value)||8;}
  if(d.tipo==='emenda'){var e4=document.getElementById('pi-bandejas');if(e4)d.bandejas=parseInt(e4.value)||12;}
  if(d.tipo==='deriv'){var e5=document.getElementById('pi-cap');if(e5)d.capacidade=parseInt(e5.value)||8;}
  document.getElementById('em-h2').textContent=d.nome||d.id;
  if(d.tipo==='poste')refreshPosteIcon(d);
  if(d.tipo==='armario')refreshArmarioIcon(d);
  bindPosteTooltip(d);
  debouncedUpdList();scheduleAutosave();
  stateManager.pushState('Editar '+(d.nome||d.id));
  var btn=event.target;btn.textContent='✓ Salvo!';setTimeout(function(){btn.textContent='✓ Salvar';},1500);
}

// ══ ALTERAR CABO ════════════════════════════════════════════════
var _caboParaAlterar=null;
function openAlterarCaboModal(d){
  _caboParaAlterar=d;closeEmModal();
  document.getElementById('alterar-cm-id').value=d.nome||d.id;
  document.getElementById('alterar-cm-color').value=d.color;
  var grid=document.getElementById('alterar-cable-type-grid');
  grid.innerHTML=CABLE_TYPES.map(function(ct){
    return '<div class="ctb" data-id="'+ct.id+'" onclick="selectAlterarCableType(\''+ct.id+'\')">'+'<div class="ctb-name" style="color:'+ct.color+'">'+ct.name+'</div>'+'<div class="ctb-desc">'+ct.desc+'</div></div>';
  }).join('');
  var cur=d.typeId||'fo-12';
  document.querySelectorAll('#alterar-cable-type-grid .ctb').forEach(function(b){b.classList.toggle('sel',b.dataset.id===cur);});
  renderRecentColors('alterar-cm-recent-colors','alterar-cm-color');
  document.getElementById('alterar-cabo-overlay').style.display='flex';
}
function selectAlterarCableType(id){document.querySelectorAll('#alterar-cable-type-grid .ctb').forEach(function(b){b.classList.toggle('sel',b.dataset.id===id);});}
function closeAlterarCaboModal(){document.getElementById('alterar-cabo-overlay').style.display='none';_caboParaAlterar=null;if(currentEM)openEmModal(currentEM);}
function confirmAlterarCabo(){
  if(!_caboParaAlterar)return;
  var d=_caboParaAlterar;
  var novoNome=document.getElementById('alterar-cm-id').value.trim();
  var novaCor=document.getElementById('alterar-cm-color').value;
  var sel2=document.querySelector('#alterar-cable-type-grid .ctb.sel');
  var typeId=sel2?sel2.dataset.id:'fo-12';
  var ct=CABLE_TYPES.find(function(c){return c.id===typeId;})||CABLE_TYPES[1];
  saveRecentColor(novaCor);
  d.nome=novoNome||d.id;d.color=novaCor;d.typeId=typeId;d.typeName=ct.name;
  d.grupos=ct.grupos;d.fpg=ct.fpg;d.total=ct.grupos*ct.fpg;d.estilo=ct.estilo;
  d.fibers={connections:[],splitters:[],diagramPositions:{}};
  if(d.poly)d.poly.setStyle({color:novaCor});
  updCableLegend();
  document.getElementById('alterar-cabo-overlay').style.display='none';
  _caboParaAlterar=null;
  showToast('✓ Cabo alterado com sucesso','success');
  scheduleAutosave();
  stateManager.pushState('Alterar '+(d.nome||d.id));
}

// ══ QUICK ADD & SUB-ELEMENT ═════════════════════════════════════
function quickAdd(tipo,parentElem){
  if(tipo==='olt'){openSubElemModal('olt',parentElem);return;}
  if((tipo==='cto'||tipo==='deriv')&&parentElem.tipo==='poste'){
    var hasEmenda=(parentElem.children||[]).some(function(c){return c.tipo==='emenda';});
    if(!hasEmenda){closeEmModal();_lastParentForEmendaWarning=parentElem;document.getElementById('emenda-warning-overlay').style.display='flex';return;}
  }
  if(tipo==='emenda'){
    var jaTemEmenda=(parentElem.children||[]).some(function(c){return c.tipo==='emenda';});
    if(jaTemEmenda){showToast('Este '+parentElem.tipo+' já possui uma emenda vinculada','warning');return;}
    var nd=addSubElement('emenda',parentElem);map.setView([nd.lat,nd.lng],18);showToast('Emenda '+(nd.nome||nd.id)+' criada.');if(currentEM&&currentEM.id===parentElem.id)openEmModal(parentElem);return;
  }
  openSubElemModal(tipo,parentElem);
}

document.getElementById('btn-emenda-warning-ok').addEventListener('click',function(){
  document.getElementById('emenda-warning-overlay').style.display='none';
  if(_lastParentForEmendaWarning){openEmModal(_lastParentForEmendaWarning);_lastParentForEmendaWarning=null;}
});

function openSubElemModal(tipo,parentElem){
  _subPending={tipo:tipo,parent:parentElem};
  var isOLT=tipo==='olt',isCTO=tipo==='cto';
  document.getElementById('sub-modal-title').textContent=isOLT?'Nova OLT vinculada':isCTO?'Nova CTO vinculada':'Nova Derivação vinculada';
  document.getElementById('sub-parent-info').textContent='Vinculado a: '+(parentElem.nome||parentElem.id);
  var iconColor=isOLT?'#06B6D4':isCTO?'#F59E0B':'#8B5CF6';
  var iconBg=isOLT?'#0a3a1a':isCTO?'#3d2a0a':'#1a2433';
  var ic=document.getElementById('sub-icon');
  ic.style.cssText='background:'+iconBg+';border:2px solid '+iconColor+';color:'+iconColor+';width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--mono);flex-shrink:0';
  ic.textContent=isOLT?'OLT':isCTO?'CTO':'⑂';
  document.getElementById('sub-nome').value='';
  document.getElementById('sub-obs').value='';
  document.getElementById('sub-spec-input').value=isOLT?'16':'8';
  document.getElementById('sub-spec-label').textContent=isOLT?'Portas':isCTO?'Portas':'Capacidade';
  var splitRow=document.getElementById('sub-split-row');
  splitRow.style.display=isOLT?'none':'block';
  if(!isOLT){document.getElementById('sub-split-1-8').classList.add('sel');document.getElementById('sub-split-1-16').classList.remove('sel');document.getElementById('sub-split-none').classList.remove('sel');}
  closeEmModal();
  document.getElementById('sub-overlay').style.display='flex';
}
function selectSubSplit(val){
  var idMap={'1/8':'sub-split-1-8','1/16':'sub-split-1-16','none':'sub-split-none'};
  Object.keys(idMap).forEach(function(v){var el=document.getElementById(idMap[v]);if(el)el.classList.toggle('sel',v===val);});
  var sp=document.getElementById('sub-spec-input');if(!sp)return;
  if(val==='1/16')sp.value=16;else if(val==='1/8')sp.value=8;
}
function confirmSubModal(){
  var tipo=_subPending.tipo,parent=_subPending.parent;if(!tipo||!parent)return;
  var nome=document.getElementById('sub-nome').value.trim();
  var obs=document.getElementById('sub-obs').value.trim();
  var spec=parseInt(document.getElementById('sub-spec-input').value)||(tipo==='olt'?16:8);
  var splitterRatio=null;
  if(tipo!=='olt'){if(document.getElementById('sub-split-1-8').classList.contains('sel'))splitterRatio='1/8';else if(document.getElementById('sub-split-1-16').classList.contains('sel'))splitterRatio='1/16';}
  var nd=addSubElement(tipo,parent,{nome:nome||undefined,obs:obs||undefined,portas:spec,capacidade:spec,splitter:splitterRatio});
  closeSubModal();map.setView([nd.lat,nd.lng],18);debouncedUpdList();openEmModal(parent);
}
function closeSubModal(){
  document.getElementById('sub-overlay').style.display='none';
  var parent=_subPending.parent;_subPending={tipo:null,parent:null};
  if(parent&&!currentEM)openEmModal(parent);
  else if(parent&&currentEM&&currentEM.id!==parent.id)openEmModal(parent);
}
// zoomTo e findById definidos em ui.js

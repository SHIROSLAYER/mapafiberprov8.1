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
  [].concat(ctos||[],emendas||[],derivs||[],olts||[],mpls||[]).forEach(function(e){
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
    connections:(function(){
      // Conexões LOCAIS deste elemento (editáveis aqui)
      var local=(d.fibers.connections||[]).filter(function(c){return c&&c.fromId;});
      // Conexões REMOTAS — feitas em outros postes/armários mas envolvendo cabos
      // que aparecem neste diagrama. Mostradas como "conectadas em outro local".
      var cableIdsHere={};
      (function(){
        var seenIds={};
        var subs=(d.children||[]).map(function(c){return c.id;});
        [].concat(ctos||[],emendas||[],derivs||[],olts||[],mpls||[]).forEach(function(e){
          if(e.parentId===d.id&&!seenIds[e.id]){seenIds[e.id]=true;}
        });
        // Coleta cable IDs (sem o prefixo cable: e sem ::I/::O)
        (function near(){
          if(typeof cablesNear==='function'){
            cablesNear(d).forEach(function(c){cableIdsHere[c.id]=true;});
          }
        })();
      })();
      var remote=[];
      [].concat(postes||[],armarios||[]).forEach(function(other){
        if(other.id===d.id)return;
        ((other.fibers||{}).connections||[]).forEach(function(c){
          if(!c||!c.fromId)return;
          var cabId=null;
          if(c.fromId.indexOf('cable:')===0)cabId=c.fromId.slice(6).replace('::I','').replace('::O','');
          else if(c.toId.indexOf('cable:')===0)cabId=c.toId.slice(6).replace('::I','').replace('::O','');
          if(cabId&&cableIdsHere[cabId]){
            remote.push(Object.assign({},c,{_remote:true,_ownerId:other.id,_ownerNome:other.nome||other.id}));
          }
        });
      });
      return local.concat(remote);
    })(),
    positions:d.fibers.diagramPositions||{},
    abnt:ABNT,
    neighbors:getDiagramNeighbors(d.id)
  };
  window._fiberDiagramSave=function(conns,pos){
    d.fibers.connections=conns;
    d.fibers.diagramPositions=pos;
    scheduleAutosave();
    stateManager.pushState('Diagrama '+(d.nome||d.id));
  };
  // API de versionamento exposta pro popup chamar via opener
  window._diagramVersionsList=function(){
    var vs=(d.fibers.versions||[]).slice();
    vs.sort(function(a,b){return (b.ts||0)-(a.ts||0);});
    return vs.map(function(v){return {id:v.id,label:v.label,ts:v.ts,auto:!!v.auto,connCount:(v.connections||[]).length};});
  };
  window._diagramVersionSave=function(label,connections,positions,auto){
    if(!d.fibers.versions)d.fibers.versions=[];
    var id='V'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    d.fibers.versions.push({id:id,label:label||'Sem nome',ts:Date.now(),auto:!!auto,connections:JSON.parse(JSON.stringify(connections||[])),positions:JSON.parse(JSON.stringify(positions||{}))});
    // Mantém só 5 auto-versions (FIFO)
    var autos=d.fibers.versions.filter(function(v){return v.auto;});
    if(autos.length>5){
      autos.sort(function(a,b){return a.ts-b.ts;});
      var toRm=autos.length-5;
      for(var i=0;i<toRm;i++){
        var rmId=autos[i].id;
        d.fibers.versions=d.fibers.versions.filter(function(v){return v.id!==rmId;});
      }
    }
    scheduleAutosave();
    return id;
  };
  window._diagramVersionRestore=function(versionId){
    var v=(d.fibers.versions||[]).find(function(x){return x.id===versionId;});
    if(!v)return null;
    return {connections:JSON.parse(JSON.stringify(v.connections||[])),positions:JSON.parse(JSON.stringify(v.positions||{}))};
  };
  window._diagramVersionDelete=function(versionId){
    if(!d.fibers.versions)return false;
    var n=d.fibers.versions.length;
    d.fibers.versions=d.fibers.versions.filter(function(x){return x.id!==versionId;});
    var removed=d.fibers.versions.length<n;
    if(removed)scheduleAutosave();
    return removed;
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
  // Reaproveita janela do popup quando navegando entre diagramas (window.opener._diagramTargetWin)
  var targetWin=window._diagramTargetWin||null;
  window._diagramTargetWin=null; // consome
  var w=targetWin||window.open('','_blank','width=1340,height=860,resizable=yes');
  if(!w){showToast('Pop-up bloqueado — permita pop-ups para este site','error');return;}
  try{
    w.document.open();
    w.document.write(html);
    w.document.close();
    try{w.focus();}catch(_){}
  }catch(err){
    console.error('[Diagrama] Falha ao escrever popup:',err);
    showToast('Erro ao abrir popup: '+(err.message||err),'error');
  }
}

// Calcula vizinhos (anterior/próximo) de um diagrama. Apenas postes/armários
// COM cabos ou sub-elementos vinculados (que faz sentido abrir diagrama).
function getDiagramNeighbors(elemId){
  var elem=findById(elemId);
  if(!elem)return {prev:null,next:null};
  var pool=elem.tipo==='armario'?(armarios||[]):(postes||[]);
  // Filtra só os que têm conteúdo
  var withContent=pool.filter(function(e){
    var hasChildren=(e.children||[]).length>0;
    var hasCable=(typeof cablesNear==='function')?cablesNear(e).length>0:false;
    return hasChildren||hasCable;
  });
  var idx=withContent.findIndex(function(e){return e.id===elemId;});
  if(idx<0)return {prev:null,next:null};
  var prev=idx>0?withContent[idx-1]:withContent[withContent.length-1];
  var next=idx<withContent.length-1?withContent[idx+1]:withContent[0];
  return {
    prev:prev&&prev.id!==elemId?{id:prev.id,nome:prev.nome||prev.id,tipo:prev.tipo}:null,
    next:next&&next.id!==elemId?{id:next.id,nome:next.nome||next.id,tipo:next.tipo}:null,
    pos:idx+1,
    total:withContent.length
  };
}

// Chamada pelo popup do diagrama: navega pra outro elemento REUSANDO a janela atual
function navigateDiagram(currentWin, neighborId){
  if(!neighborId)return;
  window._diagramTargetWin=currentWin;
  openDiagramInNewTab(neighborId);
}

function buildDiagramPage(data){
  var nome=(data.elem.nome||data.elem.id).replace(/</g,'&lt;').replace(/`/g,'&#96;');
  var tipo=data.elem.tipo.toUpperCase();
  var encoded=encodeURIComponent(JSON.stringify(data));

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#1a2332">
<title>Diagrama — ${nome}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow:hidden;background:#fff;font-family:system-ui,"Segoe UI",sans-serif;color:#1a2332;-webkit-text-size-adjust:100%;overscroll-behavior:none;touch-action:manipulation}
button,.tbtn,.cbtn{touch-action:manipulation}
#tb{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#1a2332;flex-shrink:0;height:44px}
#tb-title{color:#fff;font-weight:700;font-size:13px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tbtn.nav-btn{min-width:34px;font-size:16px;font-weight:700;padding:4px 10px;background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3)}
.tbtn.nav-btn:hover:not(:disabled){background:rgba(255,255,255,.3);transform:translateX(0)}
.tbtn.nav-btn:disabled{filter:grayscale(1)}
.tbtn{padding:5px 11px;border-radius:6px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;cursor:pointer;font-size:11px;font-weight:600;transition:background .12s;white-space:nowrap}
.tbtn:hover{background:rgba(255,255,255,.22)}
.tbtn.green{border-color:rgba(29,158,117,.6);background:rgba(29,158,117,.25);color:#6ee7c0}
.tbtn.green:hover{background:rgba(29,158,117,.4)}
.tbtn.red{border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.15);color:#fca5a5}
.tbtn.amber{border-color:rgba(245,158,11,.7);background:rgba(245,158,11,.25);color:#fbbf24;animation:editPulse 1.6s ease-in-out infinite}
@keyframes editPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)}50%{box-shadow:0 0 0 4px rgba(245,158,11,0)}}
body.edit-mode .fdot{cursor:crosshair}
body:not(.edit-mode) .fdot{cursor:help}
body:not(.edit-mode) .fdot:hover:not(.drag-src){filter:drop-shadow(0 0 4px rgba(96,165,250,.6))}
#area{flex:1;position:relative;overflow:hidden;background-color:#fff;background-image:radial-gradient(circle,#c8d0dc 1.3px,transparent 1.3px);background-size:24px 24px;cursor:grab;user-select:none}
#area.panning{cursor:grabbing}
#inner{position:absolute;top:0;left:0;width:1px;height:1px}
#svg-layer{position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;overflow:visible;z-index:5}
.cpath{fill:none;stroke:#3B82F6;stroke-width:2.4;stroke-dasharray:10 6;stroke-linecap:round;pointer-events:stroke;cursor:pointer;opacity:.85;transition:opacity .15s,stroke .15s,stroke-width .15s;animation:march 1.4s linear infinite}
.cpath-mpls{stroke:#EF4444!important;stroke-width:3!important;stroke-dasharray:6 4!important;animation:marchFast .9s linear infinite!important;filter:drop-shadow(0 0 4px rgba(239,68,68,.55))}
.cpath-loop{stroke-dasharray:3 8!important;opacity:.7;filter:drop-shadow(0 0 3px rgba(245,158,11,.6))}
.cendp-disconnect{animation:pulseDisc 1.4s ease-in-out infinite}
@keyframes pulseDisc{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes marchFast{to{stroke-dashoffset:-32}}
.cpath:hover{stroke:#60a5fa;opacity:1;stroke-width:3.2}
.cpath.sel{stroke:#F59E0B;stroke-width:4;opacity:1;stroke-dasharray:none;animation:none;filter:drop-shadow(0 0 6px rgba(245,158,11,.7))}
#prev-path{fill:none;stroke:#F59E0B;stroke-width:2.6;stroke-dasharray:8 5;stroke-linecap:round;pointer-events:none;display:none;animation:march 0.7s linear infinite;filter:drop-shadow(0 0 4px rgba(245,158,11,.6))}
@keyframes march{to{stroke-dashoffset:-32}}
@keyframes srcPulse{0%,100%{filter:drop-shadow(0 0 6px #F59E0B) drop-shadow(0 4px 10px rgba(245,158,11,.5))}50%{filter:drop-shadow(0 0 14px #F59E0B) drop-shadow(0 4px 14px rgba(245,158,11,.8))}}
.panel{position:absolute;background:#fff;border-radius:10px;box-shadow:0 3px 18px rgba(0,0,0,.13);border:1.5px solid #e2e8f0;z-index:10;user-select:none;min-width:150px;max-width:290px}
.panel.dragging{box-shadow:0 8px 32px rgba(0,0,0,.2);z-index:20;border-color:#94a3b8;will-change:left,top;cursor:grabbing!important}
.phdr{padding:7px 8px;border-radius:8px 8px 0 0;cursor:grab;display:flex;align-items:center;gap:5px;font-weight:700;font-size:11px;color:#fff;touch-action:none;line-height:1.3}
.phdr:active{cursor:grabbing}
.psub{font-size:7.5px;font-weight:400;opacity:.85;background:rgba(0,0,0,.18);border-radius:3px;padding:1px 5px;font-family:monospace;flex-shrink:0}
.premove{background:rgba(0,0,0,.2);border:none;color:#fff;width:18px;height:18px;border-radius:3px;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:.7;line-height:1;padding:0;transition:opacity .1s,background .1s}
.premove:hover{opacity:1;background:rgba(239,68,68,.55)}
.fdot{width:36px;height:16px;cursor:crosshair;transition:transform .12s,filter .12s;flex-shrink:0;display:block;overflow:visible;position:relative;z-index:1}
.fdot .fhx{stroke:rgba(0,0,0,.55);stroke-width:1;transition:stroke .15s,stroke-width .15s}
.fdot:hover:not(.drag-src){transform:scale(1.28);z-index:15;filter:drop-shadow(0 0 4px rgba(59,130,246,.7))}
.fdot:hover:not(.drag-src) .fhx{stroke:#3B82F6;stroke-width:2.5}
.fdot.conn .fhx{stroke:#0d6b50;stroke-width:1.6}
/* Fibra com emenda local que carrega sinal de MPLS — destaca vermelho com glow forte. */
.fdot.conn.upstream-mpls .fhx{stroke:#EF4444!important;stroke-width:2.6!important;filter:drop-shadow(0 0 6px rgba(239,68,68,.95))!important}
.fdot.conn.upstream-mpls .fcheck circle{fill:#EF4444!important}
.fdot.conn.upstream-mpls{filter:drop-shadow(0 0 4px rgba(239,68,68,.6))}
/* Fibra com emenda local que carrega sinal de OLT — destaca laranja com glow forte (igual ao MPLS, em cor diferente). */
.fdot.conn.upstream-olt .fhx{stroke:#F59E0B!important;stroke-width:2.6!important;filter:drop-shadow(0 0 6px rgba(245,158,11,.95))!important}
.fdot.conn.upstream-olt .fcheck circle{fill:#F59E0B!important}
.fdot.conn.upstream-olt{filter:drop-shadow(0 0 4px rgba(245,158,11,.6))}
.fdot.remote-conn .fhx{stroke:#06B6D4;stroke-width:1.6;stroke-dasharray:2 1.5}
/* Fibra carregando sinal de passagem (OLT/MPLS upstream, sem emenda local) */
.fdot.upstream-olt .fhx{stroke:#F59E0B;stroke-width:1.4;stroke-dasharray:4 2;opacity:.85}
.fdot.upstream-mpls .fhx{stroke:#EF4444;stroke-width:1.6;stroke-dasharray:4 2;opacity:.9}
.fdot.lit .fhx{stroke:#F59E0B;stroke-width:3;filter:drop-shadow(0 0 6px rgba(245,158,11,.85))}
.fdot.lit{transform:scale(1.18);z-index:18}
/* Badge ✓ verde — APENAS conexão local (ligação feita neste diagrama) */
.fdot .fcheck{opacity:0;transition:opacity .15s}
.fdot.conn .fcheck,.fdot.remote-conn .fcheck{opacity:1}
.fdot.remote-conn .fcheck circle{fill:#06B6D4!important}
/* Badge ▸ laranja — fibra de passagem com sinal de OLT/MPLS */
.fdot .farrow{opacity:0;transition:opacity .15s}
.fdot.upstream-olt .farrow,.fdot.upstream-mpls .farrow{opacity:1}
.fdot.upstream-mpls .farrow path{fill:#EF4444!important}
/* Conn (emenda local) tem prioridade visual: esconde flecha, mostra check */
.fdot.conn .farrow{opacity:0!important}
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
.fiber-float{position:fixed;width:300px;max-width:92vw;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.4);z-index:9000;font-family:system-ui,"Segoe UI",sans-serif;font-size:12px;color:#1a2332;display:none;overflow:hidden;animation:floatIn .18s ease-out}
.fiber-float.on{display:block}
.fiber-float.centered{width:380px;max-height:70vh;overflow-y:auto}
@keyframes floatIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.fiber-float.centered{transform:translateX(-50%)}
.fiber-float .ff-hdr{padding:10px 12px;display:flex;flex-direction:column;gap:2px;font-size:12px}
.fiber-float .ff-hdr b{font-weight:800;font-size:13px}
.fiber-float .ff-hdr span{font-size:10px;opacity:.9;font-family:monospace}
.fiber-float .ff-row{padding:6px 12px;display:flex;gap:6px;font-size:11px;border-bottom:1px solid #f1f5f9}
.fiber-float .ff-lbl{color:#6b7280;font-family:monospace}
.fiber-float .ff-peer{padding:8px 12px;background:#f8fafc;border-bottom:1px solid #f1f5f9;font-size:11px;line-height:1.6}
.fiber-float .ff-peer b{font-weight:700;color:#1a2332}
.fiber-float .ff-peer span{color:#6b7280;font-family:monospace;font-size:10px}
.fiber-float .ff-actions{display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:#f8fafc}
.fiber-float .ff-btn{padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;color:#1a2332;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit;transition:all .12s;text-align:left}
.fiber-float .ff-btn:hover{background:#f1f5f9;border-color:#94a3b8}
.fiber-float .ff-btn.warn{border-color:#fca5a5;color:#dc2626;background:#fef2f2}
.fiber-float .ff-btn.warn:hover{background:#fee2e2}
.fiber-float .ff-path{padding:8px 12px;display:flex;flex-direction:column;gap:6px}
.fiber-float .ff-hop{display:flex;gap:8px;align-items:center}
.fiber-float .ff-hop-num{width:22px;height:22px;border-radius:50%;background:#0d6b50;color:#fff;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:monospace}
.fiber-float .ff-hop-info{flex:1;padding:6px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;line-height:1.5}
.fiber-float .ff-hop-info b{font-weight:700}
.fiber-float .ff-hop-info span{color:#6b7280;font-family:monospace;font-size:10px}
.fiber-float .ff-hop-arrow{padding-left:30px;font-size:10px;color:#9ca3af;font-family:monospace}
.fiber-float .ff-info{font-size:10px;color:#1e3a5f;background:#dbeafe;border-left:3px solid #06B6D4;padding:6px 10px;border-radius:4px;line-height:1.5}
/* Botões do modal de confirmar fechar — visual escuro */
.cbtn{padding:11px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;transition:all .15s;text-align:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.cbtn-save{background:#10B981;color:#fff;border-color:#059669}
.cbtn-save:hover{background:#059669;box-shadow:0 4px 12px rgba(16,185,129,.4)}
.cbtn-disc{background:#dc2626;color:#fff;border-color:#b91c1c}
.cbtn-disc:hover{background:#b91c1c;box-shadow:0 4px 12px rgba(220,38,38,.4)}
.cbtn-cancel{background:transparent;color:#94a3b8;border-color:#475569}
.cbtn-cancel:hover{background:#1e293b;color:#e2e8f0;border-color:#64748b}
/* Responsividade do popup (iPhone/tablet) */
@media (max-width:640px){
  #tb{flex-wrap:wrap;height:auto;min-height:44px;padding:6px 8px;gap:4px}
  #tb-title{flex-basis:100%;font-size:12px;order:-1;padding:2px 0;text-align:center}
  .tbtn{padding:6px 10px;font-size:11px}
  #sb{flex-wrap:wrap;gap:4px;height:auto;min-height:24px;padding:4px 8px;font-size:9px}
  .panel{transform:scale(.95);transform-origin:top left}
  .fiber-float{width:90vw;max-width:340px;font-size:12px}
  .fiber-float.centered{width:92vw;max-width:380px}
}
@media (max-width:420px){
  .tbtn{padding:5px 8px;font-size:10px}
  #tb{padding:4px}
}
.cv-panel{max-width:none!important;min-width:0!important}
.cv-lbar{flex-direction:column!important;align-items:center!important;justify-content:space-between!important;border-radius:0!important;gap:0!important;padding:8px 0 6px!important}
.cv-ltxt{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:800;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;padding:6px 0;color:#fff;cursor:grab;font-family:monospace;letter-spacing:.4px;flex:1;min-height:0}
/* Modal de Versões */
#ver-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;align-items:center;justify-content:center;padding:16px}
#ver-overlay.on{display:flex}
.ver-modal{background:#1a2332;border:1px solid #3b82f6;border-radius:12px;width:min(560px,96vw);max-height:88vh;overflow:hidden;display:flex;flex-direction:column;color:#e2e8f0;box-shadow:0 20px 60px rgba(0,0,0,.7)}
.ver-hdr{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #334155;background:#0f1d2e}
.ver-hdr h3{margin:0;font-size:15px;color:#60a5fa}
.ver-hdr-x{background:transparent;border:0;color:#94a3b8;font-size:20px;cursor:pointer;padding:0 6px;line-height:1}
.ver-body{padding:14px 18px;overflow-y:auto;flex:1}
.ver-newbox{background:#0f1d2e;border:1px solid #334155;border-radius:8px;padding:10px;margin-bottom:14px;display:flex;gap:8px;align-items:center}
.ver-newbox input{flex:1;background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:7px 10px;font-size:13px;font-family:inherit}
.ver-newbox button{background:#10b981;color:#fff;border:0;border-radius:6px;padding:7px 14px;font-weight:700;cursor:pointer;font-size:13px}
.ver-newbox button:hover{background:#059669}
.ver-list{display:flex;flex-direction:column;gap:6px}
.ver-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0f1d2e;border:1px solid #334155;border-radius:8px}
.ver-item-info{flex:1;min-width:0}
.ver-item-label{font-weight:700;color:#e2e8f0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ver-item-meta{font-size:10px;color:#94a3b8;font-family:monospace;margin-top:2px}
.ver-item-auto{background:rgba(245,158,11,.18);color:#fbbf24;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;margin-left:4px}
.ver-item-btn{padding:5px 10px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#cbd5e1;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit}
.ver-item-btn:hover{background:#334155}
.ver-item-btn.warn{border-color:rgba(239,68,68,.4);color:#fca5a5}
.ver-item-btn.warn:hover{background:rgba(239,68,68,.15)}
.ver-empty{padding:24px;text-align:center;color:#64748b;font-size:12px;font-family:monospace}
</style>
</head>
<body style="display:flex;flex-direction:column;height:100%">
<div id="tb">
  <button class="tbtn nav-btn" id="btn-prev-diag" onclick="navPrevDiagram()" title="Diagrama anterior (Ctrl+←)" ${data.neighbors&&data.neighbors.prev?'':'disabled style="opacity:.3;cursor:not-allowed"'}>&#8592;</button>
  <span id="tb-title">${nome} <span style="font-size:9px;background:rgba(255,255,255,.15);border-radius:4px;padding:1px 6px;font-family:monospace;font-weight:400">${tipo}</span>${data.neighbors&&data.neighbors.total>1?'<span style="font-size:9px;background:rgba(255,255,255,.10);border-radius:4px;padding:1px 6px;margin-left:4px;font-family:monospace;font-weight:400;color:rgba(255,255,255,.7)">'+data.neighbors.pos+'/'+data.neighbors.total+'</span>':''}</span>
  <button class="tbtn nav-btn" id="btn-next-diag" onclick="navNextDiagram()" title="Próximo diagrama (Ctrl+→)" ${data.neighbors&&data.neighbors.next?'':'disabled style="opacity:.3;cursor:not-allowed"'}>&#8594;</button>
  <button class="tbtn green" id="btn-save" onclick="doSave()">&#x1F4BE; Salvar</button>
  <button class="tbtn" id="btn-edit-mode" onclick="toggleEditMode()" title="Habilita arrastar fibras para conectar">&#x270F;&#xFE0F; Modo Edi&ccedil;&atilde;o</button>
  <button class="tbtn red" id="btn-remove-conns" onclick="askRemoveAllConns()" title="Remove todas as liga&ccedil;&otilde;es de fibra">&#x1F5D1; Remover conex&otilde;es</button>
  <button class="tbtn red" id="btn-remove-conn" style="display:none" onclick="removeSelectedConn()">&#x2715; Remover liga&ccedil;&atilde;o</button>
  <button class="tbtn" onclick="zoomBy(0.85)" title="Diminuir zoom">&#8722;</button>
  <button class="tbtn" onclick="resetZoom()" title="Resetar zoom e pan">100%</button>
  <button class="tbtn" onclick="zoomBy(1.18)" title="Aumentar zoom">+</button>
  <button class="tbtn" onclick="resetLayout()">&#8635; Layout</button>
  <button class="tbtn" onclick="showVersionsModal()" title="Versões salvas do diagrama">&#128218; Versões</button>
  <button class="tbtn" onclick="exportDiagramPNG()" title="Exportar como imagem PNG">&#128247; PNG</button>
  <button class="tbtn" onclick="exportDiagramPDF()" title="Exportar como documento PDF">&#128196; PDF</button>
  <button class="tbtn" onclick="requestClose()">Fechar</button>
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
<div id="sb"><span id="sb-msg">🔒 Visualização — clique nas fibras para ver dados · Ative "Modo Edição" para alterar</span><span id="sb-cnt">0 conexões</span></div>
<div id="close-conf-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;padding:16px"><div style="background:#1a2332;border:1px solid #3b82f6;border-radius:14px;width:min(420px,94vw);padding:22px 24px;box-shadow:0 24px 80px rgba(0,0,0,.8);text-align:center;color:#e2e8f0"><div style="font-size:36px;margin-bottom:10px">⚠️</div><h3 style="margin:0 0 8px;color:#fbbf24;font-size:17px;font-weight:700">Há alterações não salvas</h3><p style="margin:0 0 18px;color:#94a3b8;font-size:13px;line-height:1.55">As alterações no diagrama (conexões, posições dos painéis) ainda não foram salvas. O que deseja fazer?</p><div style="display:flex;gap:8px;flex-direction:column"><button class="cbtn cbtn-save" onclick="confirmCloseSave()">&#x1F4BE; Salvar e fechar</button><button class="cbtn cbtn-disc" onclick="confirmCloseDiscard()">&#x21A9; Descartar e fechar</button><button class="cbtn cbtn-cancel" onclick="hideCloseConf()">Cancelar (continuar editando)</button></div></div></div>
<div id="tip"></div>
<div id="err-box"></div>
<div id="ver-overlay" onclick="if(event.target.id==='ver-overlay')closeVersionsModal()">
  <div class="ver-modal">
    <div class="ver-hdr"><h3>📚 Versões do diagrama</h3><button class="ver-hdr-x" onclick="closeVersionsModal()">×</button></div>
    <div class="ver-body">
      <div class="ver-newbox">
        <input id="ver-new-label" type="text" placeholder="Nome da versão (ex: antes da troca CTO-3)" maxlength="50">
        <button onclick="saveCurrentVersion()">💾 Salvar versão atual</button>
      </div>
      <div class="ver-list" id="ver-list"></div>
    </div>
  </div>
</div>
<script type="application/json" id="ddata">${encoded}</script>
<script>
// Carrega html2canvas e jspdf via appendChild (evita o warning do Chrome
// "parser-blocking, cross-site script invoked via document.write").
(function loadCDN(){
  ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
   'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'].forEach(function(src){
    var s=document.createElement('script');s.src=src;s.async=true;document.head.appendChild(s);
  });
})();
<\/script>
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
var panScale=1,MIN_SCALE=0.3,MAX_SCALE=3,pinchStart=null;
var editMode=false; // padrão: visualização (drag desabilitado)

function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function isConn(eid,fi){
  return connections.some(function(c){
    var match=(c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi);
    if(!match)return false;
    // Conexão remota (em outro elemento) — só verifica que o eid+fi local existe
    if(c._remote)return true;
    // Local — só conta se o outro endpoint existe no diagrama (não é órfã)
    var oEid=c.fromId===eid?c.toId:c.fromId;
    var oFi=c.fromId===eid?c.toFi:c.fromFi;
    return !!document.querySelector('.fdot[data-eid="'+oEid+'"][data-fi="'+oFi+'"]');
  });
}
function isLocalConn(eid,fi){
  // Versão estrita: só conta conexões LOCAIS (editáveis aqui)
  return connections.some(function(c){
    if(c._remote)return false;
    return(c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi);
  });
}
function isRemoteConn(eid,fi){
  return connections.some(function(c){
    if(!c._remote)return false;
    return(c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi);
  });
}
function getRemoteConnOwner(eid,fi){
  var c=connections.find(function(c){return c._remote&&((c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi));});
  return c?(c._ownerNome||c._ownerId):null;
}
function getConn(eid,fi){return connections.find(function(c){return(c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi);});}
function lightness(hex){var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return(r*299+g*587+b*114)/1000;}

// ── Pan + Zoom ───────────────────────────────────────────────────
function applyPan(x,y){
  panX=x;panY=y;
  var inner=document.getElementById('inner');
  inner.style.transformOrigin='0 0';
  inner.style.transform='translate('+x+'px,'+y+'px) scale('+panScale+')';
  var a=document.getElementById('area');
  var step=24*panScale;
  a.style.backgroundPosition=(((x%step)+step)%step)+'px '+(((y%step)+step)%step)+'px';
  a.style.backgroundSize=step+'px '+step+'px';
}
function applyZoom(newScale,cxArea,cyArea){
  newScale=Math.max(MIN_SCALE,Math.min(MAX_SCALE,newScale));
  if(Math.abs(newScale-panScale)<0.001)return;
  // Mantém ponto sob o cursor estacionário
  var wx=(cxArea-panX)/panScale;
  var wy=(cyArea-panY)/panScale;
  panScale=newScale;
  applyPan(cxArea-wx*panScale, cyArea-wy*panScale);
  drawSVG&&drawSVG();
}
function zoomBy(factor,cxArea,cyArea){
  var rect=document.getElementById('area').getBoundingClientRect();
  if(cxArea==null){cxArea=rect.width/2;cyArea=rect.height/2;}
  applyZoom(panScale*factor,cxArea,cyArea);
}
function resetZoom(){
  panScale=1;
  applyPan(0,0);
  drawSVG&&drawSVG();
}

var area=document.getElementById('area');
// Zoom com scroll do mouse
area.addEventListener('wheel',function(e){
  if(pdrag||fdrag)return;
  e.preventDefault();
  var rect=area.getBoundingClientRect();
  var factor=e.deltaY>0?0.88:1.13;
  applyZoom(panScale*factor, e.clientX-rect.left, e.clientY-rect.top);
},{passive:false});
// Zoom com gesto de pinça (touch)
area.addEventListener('touchstart',function(e){
  if(e.touches.length===2){
    var t1=e.touches[0],t2=e.touches[1];
    var dist=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
    var rect=area.getBoundingClientRect();
    pinchStart={dist:dist,scale:panScale,cx:(t1.clientX+t2.clientX)/2-rect.left,cy:(t1.clientY+t2.clientY)/2-rect.top};
    panning=null;
  }
},{passive:true});
area.addEventListener('touchmove',function(e){
  if(e.touches.length===2&&pinchStart){
    e.preventDefault();
    var t1=e.touches[0],t2=e.touches[1];
    var dist=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
    applyZoom(pinchStart.scale*(dist/pinchStart.dist), pinchStart.cx, pinchStart.cy);
  }
},{passive:false});
area.addEventListener('touchend',function(e){
  if(e.touches.length<2)pinchStart=null;
});
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
    var FH=20,TH=12;
    var totalH=c.grupos*(TH+c.fpg*FH)+12;
    div.className='panel cv-panel';
    div.style.cssText='width:86px;display:flex;flex-direction:'+(isE?'row':'row-reverse')+';min-height:'+totalH+'px;border-radius:8px;overflow:hidden;';
    div.appendChild(buildLbar());
    var bdy2=document.createElement('div');
    bdy2.style.cssText='width:64px;flex-shrink:0;position:relative;background:#f8fafc;';
    var tb2=document.createElement('div');
    tb2.style.cssText='position:absolute;top:0;bottom:0;width:8px;background:#808080;border:1px solid #555;z-index:0;'+(isE?'left:0':'right:0');
    bdy2.appendChild(tb2);
    for(var g=0;g<c.grupos;g++){
      var tc=ABNT[g%12];
      var tr=parseInt(tc.hex.slice(1,3),16),tg=parseInt(tc.hex.slice(3,5),16),tb3=parseInt(tc.hex.slice(5,7),16);
      var bright=(tr*299+tg*587+tb3*114)/1000;
      var thdr=document.createElement('div');
      thdr.style.cssText='display:flex;align-items:center;justify-content:center;height:'+TH+'px;position:relative;z-index:2;background:'+tc.hex+';padding:0 2px;font-size:8px;font-weight:800;font-family:monospace;letter-spacing:.2px;color:'+(bright>160?'#000':'#fff')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      thdr.textContent='T'+('0'+(g+1)).slice(-2)+'·'+tc.name.toUpperCase();
      thdr.title='Tubo '+(g+1)+' — '+tc.name;
      bdy2.appendChild(thdr);
      for(var f2=0;f2<c.fpg;f2++){
        var fi2=g*c.fpg+f2;
        var fc2=ABNT[f2%12];
        var row2=document.createElement('div');
        row2.style.cssText='display:flex;align-items:center;justify-content:center;height:'+FH+'px;position:relative;z-index:1;gap:0;padding:0;';
        var dot2=makeDot(pid,fi2,fc2.hex,f2+1,'Cabo '+escH(c.nome||c.id)+' — T'+(g+1)+' F'+(f2+1),isE?'R':'L');
        if(isConn(pid,fi2))dot2.classList.add('conn');
        row2.appendChild(dot2);
        bdy2.appendChild(row2);
      }
    }
    div.appendChild(bdy2);
    return div;
  }

  // ── Tubo único (1 grupo) — visual ultra compacto, sem seta ────
  var FH=24;
  var panelH=c.fpg*FH+12;
  div.className='panel cv-panel';
  div.style.cssText='width:86px;display:flex;flex-direction:'+(isE?'row':'row-reverse')+';min-height:'+panelH+'px;border-radius:8px;overflow:hidden;';
  div.appendChild(buildLbar());
  var bdy=document.createElement('div');
  bdy.style.cssText='width:64px;flex-shrink:0;position:relative;background:#f8fafc;';
  var tb=document.createElement('div');
  tb.style.cssText='position:absolute;top:0;bottom:0;width:8px;background:#808080;border:1px solid #555;z-index:0;'+(isE?'left:0':'right:0');
  bdy.appendChild(tb);
  for(var f=0;f<c.fpg;f++){
    var fi=f,fc=ABNT[f%12];
    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;justify-content:center;height:'+FH+'px;position:relative;z-index:1;gap:0;padding:0;';
    var dot=makeDot(pid,fi,fc.hex,f+1,'Cabo '+escH(c.nome||c.id)+' — F'+(f+1),isE?'R':'L');
    if(isConn(pid,fi))dot.classList.add('conn');
    row.appendChild(dot);
    bdy.appendChild(row);
  }
  div.appendChild(bdy);
  return div;
}

// ── Helpers para painéis verticais (CTO/Deriv/OLT) ──────────────
function getOLTInfoForChild(s){
  // Busca a conexão local da entrada do CTO/Deriv → cable e rastreia até a OLT/MPLS.
  // Retorna {tipo:'olt'|'mpls', nome, pon} ou null
  var entryEid=(s.tipo==='olt'||s.tipo==='mpls')?null:('in:'+s.id);
  if(!entryEid)return null;
  for(var i=0;i<connections.length;i++){
    var c=connections[i];
    var peer=null;
    if(c.fromId===entryEid&&c.fromFi===0)peer={eid:c.toId,fi:c.toFi};
    else if(c.toId===entryEid&&c.toFi===0)peer={eid:c.fromId,fi:c.fromFi};
    if(!peer||peer.eid.indexOf('cable:')!==0)continue;
    var cabId=peer.eid.slice(6).replace('::I','').replace('::O','');
    try{
      if(window.opener&&typeof window.opener.findSourceForFiber==='function'){
        var info=window.opener.findSourceForFiber(cabId,peer.fi);
        if(info)return info;
      }else if(window.opener&&typeof window.opener.findOLTForFiber==='function'){
        var olt=window.opener.findOLTForFiber(cabId,peer.fi);
        if(olt)return {tipo:'olt',nome:olt.nome,pon:olt.pon};
      }
    }catch(_){}
  }
  return null;
}

// ── Build child panel ───────────────────────────────────────────
function buildChildPanel(s){
  // CTO=verde, Deriv=roxo, OLT=ciano, MPLS=vermelho, Emenda=vermelho
  var COL={cto:'#10B981',emenda:'#EF4444',deriv:'#8B5CF6',olt:'#06B6D4',mpls:'#EF4444'};
  var TIPO={cto:'CTO',emenda:'Emenda',deriv:'Derivação',olt:'OLT',mpls:'MPLS'};
  var sc=COL[s.tipo]||'#888';
  var rawNome=s.nome||s.id;
  var tipoLbl=TIPO[s.tipo]||s.tipo.toUpperCase();
  var fullLabel=tipoLbl+' '+rawNome;
  var pid='child:'+s.id;
  var div=document.createElement('div');div.dataset.pid=pid;

  // Emenda mantém visual antigo (caixa pequena com info textual)
  if(s.tipo==='emenda'){
    div.className='panel';
    var hdr=makePanelHdr(rawNome,(s.bandejas||12)+' band.',sc,pid);div.appendChild(hdr);
    var info=document.createElement('div');info.className='emenda-info';
    info.innerHTML='Emenda óptica<br><span style="opacity:.7">conecte fibras<br>entrada → saída</span>';
    div.appendChild(info);
    return div;
  }

  // CTO/Deriv/OLT/MPLS: painel vertical estreito (estilo cabo)
  var ports=s.portas||s.capacidade||8;
  var isOLT=s.tipo==='olt';
  var isMPLS=s.tipo==='mpls';
  // OLT e MPLS só têm saídas (sem input)
  var noInput=isOLT||isMPLS;
  var FH=22;
  var infoH=20;
  var totalH=ports*FH+infoH+12;
  var oltUsage=null;
  if(isOLT){
    try{
      if(window.opener&&typeof window.opener.getOltUsage==='function'){
        oltUsage=window.opener.getOltUsage(s.id,ports);
      }
    }catch(_){}
  }
  var portasLbl=isOLT?(oltUsage?(oltUsage.used+'/'+oltUsage.total+' PON'):(ports+' PON'))
               :isMPLS?(ports+' fibras')
               :(ports+' portas');

  div.className='panel cv-panel';
  div.style.cssText='width:104px;display:flex;flex-direction:row-reverse;min-height:'+totalH+'px;border-radius:8px;overflow:visible;';

  // Barra esquerda colorida com nome + info do tipo (vertical)
  var lb=document.createElement('div');
  lb.className='phdr cv-lbar';
  lb.style.cssText='width:24px;min-width:24px;flex-shrink:0;background:'+sc+';position:relative;z-index:2;border-radius:8px 0 0 8px;';
  var lt=document.createElement('span');
  lt.className='cv-ltxt';
  lt.textContent=rawNome+' · '+portasLbl;
  lt.title=fullLabel;
  lb.appendChild(lt);

  // Body (lado das ponteiras de saída)
  var bdy=document.createElement('div');
  bdy.style.cssText='flex:1;position:relative;background:#f8fafc;display:flex;flex-direction:column;justify-content:flex-start;align-items:flex-end;padding:6px 4px 6px 0;gap:3px;border-radius:0 8px 8px 0;';

  // Para CTO/Deriv (não OLT, não MPLS): input externo colado à esquerda da barra
  if(!noInput){
    var inWrap=document.createElement('div');
    inWrap.style.cssText='position:absolute;left:-30px;top:50%;transform:translateY(-50%);z-index:5;';
    var inDot=makeDot('in:'+s.id,0,sc,'1',escH(fullLabel)+' — entrada','L');
    if(isConn('in:'+s.id,0))inDot.classList.add('conn');
    inWrap.appendChild(inDot);
    lb.appendChild(inWrap);
  }

  // Header pequeno indicando o tipo de saída
  var bhdr=document.createElement('div');
  bhdr.style.cssText='font-size:8px;font-weight:800;font-family:monospace;color:#475569;text-transform:uppercase;letter-spacing:.5px;padding:2px 4px 4px 0;align-self:flex-end;';
  bhdr.textContent=isOLT?'PONs':isMPLS?'FIBRAS':'SAÍDAS';
  bdy.appendChild(bhdr);

  // Badge de status para OLT (X em uso · Y livres com cor de severidade)
  if(isOLT&&oltUsage){
    var pct=oltUsage.pct;
    var bg=pct>=0.9?'#fee2e2':pct>=0.7?'#fef3c7':pct>0?'#dcfce7':'#f1f5f9';
    var bdr=pct>=0.9?'#fca5a5':pct>=0.7?'#fcd34d':pct>0?'#86efac':'#cbd5e1';
    var txtCol=pct>=0.9?'#991b1b':pct>=0.7?'#92400e':pct>0?'#0d6b50':'#475569';
    var statusEl=document.createElement('div');
    statusEl.style.cssText='font-size:8px;font-family:monospace;font-weight:700;color:'+txtCol+';background:'+bg+';border:1px solid '+bdr+';border-radius:4px;padding:3px 5px;margin:0 0 4px 0;align-self:flex-end;max-width:62px;text-align:center;line-height:1.3;';
    statusEl.innerHTML=oltUsage.used+'/'+oltUsage.total+' uso<br><span style="opacity:.85">'+oltUsage.free+' livres</span>';
    statusEl.title='OLT '+(s.nome||s.id)+': '+oltUsage.used+' PON em uso · '+oltUsage.free+' livres ('+Math.round(pct*100)+'%)';
    bdy.appendChild(statusEl);
  }

  // Para CTO/Deriv: badge "Sinal Esperado" no corpo (legível, horizontal compacto)
  if(!noInput){
    var sigEl=document.createElement('div');
    var srcInfo=getOLTInfoForChild(s);
    // OLT mostra "Nome·PONn"; MPLS mostra só "MPLS Nome" (sem número de fibra)
    var isSrcMpls=srcInfo&&srcInfo.tipo==='mpls';
    var bg=isSrcMpls?'#fee2e2':'#dcfce7';
    var bdr=isSrcMpls?'#fca5a5':'#86efac';
    var col=isSrcMpls?'#991b1b':'#0d6b50';
    sigEl.style.cssText='font-size:7px;font-family:monospace;font-weight:700;color:'+col+';background:'+bg+';border:1px solid '+bdr+';border-radius:4px;padding:2px 4px;margin:0 0 4px 0;align-self:flex-end;max-width:62px;text-align:center;line-height:1.2;white-space:normal;word-break:break-all;';
    sigEl.textContent=srcInfo?(isSrcMpls?('MPLS·'+srcInfo.nome):(srcInfo.nome+'·PON'+srcInfo.pon)):'N/Inform.';
    sigEl.title='Sinal Esperado: '+(srcInfo?(isSrcMpls?('MPLS '+srcInfo.nome):(srcInfo.nome+' PON-'+srcInfo.pon)):'Não informado');
    bdy.appendChild(sigEl);
  }

  var portLbl=isOLT?'PON':isMPLS?'fibra':'porta';
  for(var p=0;p<ports;p++){
    var pd=makeDot('out:'+s.id,p,sc,p+1,escH(fullLabel)+' — '+portLbl+' '+(p+1),'R');
    if(isConn('out:'+s.id,p))pd.classList.add('conn');
    bdy.appendChild(pd);
  }

  div.appendChild(bdy);
  div.appendChild(lb);
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
  // Centralização vertical: usa baseline alphabetic (cross-browser confiável)
  // y=10 + dy=0.36em ajusta pra que o centro visual da letra fique no y=10
  t.setAttribute('x',String(tx));t.setAttribute('y','10');
  t.setAttribute('dy','0.36em');
  t.setAttribute('text-anchor','middle');
  t.setAttribute('font-size','11');t.setAttribute('font-weight','800');
  t.setAttribute('font-family','Helvetica,Arial,sans-serif');
  t.setAttribute('fill',lightness(color)>160?'#000':'#fff');
  t.setAttribute('pointer-events','none');
  t.textContent=label;
  svg.appendChild(t);
  var cx=tipSide==='R'?6:tipSide==='L'?44:44;
  // Badge "✓" verde no canto — CONEXÃO LOCAL (emenda/ligação feita aqui)
  var checkG=document.createElementNS(SVG_NS,'g');
  checkG.setAttribute('class','fcheck');
  checkG.setAttribute('pointer-events','none');
  var cc=document.createElementNS(SVG_NS,'circle');
  cc.setAttribute('cx',String(cx));cc.setAttribute('cy','3');cc.setAttribute('r','3');
  cc.setAttribute('fill','#10B981');cc.setAttribute('stroke','#fff');cc.setAttribute('stroke-width','0.8');
  checkG.appendChild(cc);
  svg.appendChild(checkG);
  // Badge "▸" triângulo laranja — SINAL DE PASSAGEM (fibra carrega sinal vindo de outro lugar)
  var arrG=document.createElementNS(SVG_NS,'g');
  arrG.setAttribute('class','farrow');
  arrG.setAttribute('pointer-events','none');
  var arr=document.createElementNS(SVG_NS,'path');
  // triângulo apontando pra direção do sinal (direita pra saída, esquerda pra entrada)
  if(tipSide==='L'){
    arr.setAttribute('d','M '+(cx-2.5)+',1 L '+(cx+2.5)+',3 L '+(cx-2.5)+',5 Z');
  }else{
    arr.setAttribute('d','M '+(cx-2.5)+',1 L '+(cx+2.5)+',3 L '+(cx-2.5)+',5 Z');
  }
  arr.setAttribute('fill','#F59E0B');arr.setAttribute('stroke','#fff');arr.setAttribute('stroke-width','0.8');
  arrG.appendChild(arr);
  svg.appendChild(arrG);
  bindFiberDot(svg);return svg;
}
function makeArw(isE){
  var svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('class','sarw');
  svg.setAttribute('viewBox','0 0 20 30');
  svg.setAttribute('width','13');svg.setAttribute('height','18');
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
  // Cleanup completo — remove TODOS os painéis do DOM, não só do registry
  inner.querySelectorAll('.panel').forEach(function(p){p.remove();});
  panelDom={};positions={};
  var FH=24,TH=12,GAP=18;
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
    var h=c.grupos>1?c.grupos*(TH+c.fpg*20)+12:c.fpg*FH+12;
    if(isE)yE+=h+GAP;else yS+=h+GAP;
  });
  ELEM.children.forEach(function(s){
    var pid='child:'+s.id;
    var p=buildChildPanel(s);
    p.style.left=colC+'px';p.style.top=yC+'px';
    positions[pid]={x:colC,y:yC};
    inner.appendChild(p);panelDom[pid]=p;bindPanelDrag(p,pid);
    var ports=s.portas||s.capacidade||8;
    var h=s.tipo==='emenda'?100:(ports*22+32);
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
// Throttle de mousemove via rAF — evita travadas em drag de painéis
var _mouseRaf=null,_lastMouse={x:0,y:0};
document.addEventListener('mousemove',function(e){
  _lastMouse.x=e.clientX;_lastMouse.y=e.clientY;
  if(_mouseRaf)return;
  _mouseRaf=requestAnimationFrame(function(){
    _mouseRaf=null;
    var cx=_lastMouse.x, cy=_lastMouse.y;
    if(panning){applyPan(cx-panning.sx,cy-panning.sy);return;}
    if(fdrag){updatePreview(cx,cy);return;}
    if(!pdrag)return;
    movePanel(pdrag,cx,cy);
  });
});
document.addEventListener('mouseup',function(e){
  if(panning){panning=null;area.classList.remove('panning');return;}
  if(fdrag){var t=document.elementFromPoint(e.clientX,e.clientY);var hit=t&&t.closest?t.closest('.fdot'):null;finishFiber(hit||null);return;}
  if(pdrag){pdrag.panel.classList.remove('dragging');pdrag=null;markUnsaved();}
});
var _touchRaf=null,_lastTouch={x:0,y:0};
document.addEventListener('touchmove',function(e){
  if(!e.touches.length)return;
  var t=e.touches[0];
  _lastTouch.x=t.clientX;_lastTouch.y=t.clientY;
  if(!panning&&!pdrag)return;
  if(pdrag)e.preventDefault();
  if(_touchRaf)return;
  _touchRaf=requestAnimationFrame(function(){
    _touchRaf=null;
    var cx=_lastTouch.x, cy=_lastTouch.y;
    if(panning){applyPan(cx-panning.sx,cy-panning.sy);return;}
    if(pdrag)movePanel(pdrag,cx,cy);
  });
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
  // Converte para inner-space (descontando scale)
  // SEM clamp em 0 — permite arrastar pra cima/esquerda livremente
  var nx=(cx-ir.left-drag.ox)/panScale;
  var ny=(cy-ir.top-drag.oy)/panScale;
  var cur=positions[drag.pid]||{x:nx,y:ny};
  var tryX=panelOverlaps(drag.panel,nx,cur.y)?cur.x:nx;
  var tryY=panelOverlaps(drag.panel,tryX,ny)?cur.y:ny;
  drag.panel.style.left=tryX+'px';drag.panel.style.top=tryY+'px';
  positions[drag.pid]={x:tryX,y:tryY};
  drawSVGThrottled();
}
// Throttle de drawSVG via requestAnimationFrame — performance durante drag
var _drawSVGRaf=null;
function drawSVGThrottled(){
  if(_drawSVGRaf)return;
  _drawSVGRaf=requestAnimationFrame(function(){_drawSVGRaf=null;drawSVG();});
}

function updatePreview(cx,cy){
  if(!fdrag)return;fdrag.moved=true;
  var ir=document.getElementById('inner').getBoundingClientRect();
  var fr=fdrag.el.getBoundingClientRect();
  var x1=(fr.left-ir.left+fr.width/2)/panScale, y1=(fr.top-ir.top+fr.height/2)/panScale;
  var x2=(cx-ir.left)/panScale, y2=(cy-ir.top)/panScale;
  var mx=(x1+x2)/2;
  var prev=document.getElementById('prev-path');
  prev.setAttribute('d','M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2);
  prev.style.display='inline';
}
function clearPreview(){var p=document.getElementById('prev-path');if(p)p.style.display='none';}

// ═══════════════ INFO E TRAÇADO DE FIBRA ═══════════════
function describeEndpoint(eid,fi){
  // Retorna {tipo, nome, detail, color} pra um endpoint (eid,fi)
  if(eid.indexOf('cable:')===0){
    var key=eid.slice(6); // "X" ou "X::I" ou "X::O"
    var side='';
    if(key.indexOf('::I')>=0)side=' (entrada)';
    else if(key.indexOf('::O')>=0)side=' (saída)';
    var rawId=key.replace('::I','').replace('::O','');
    var cab=CABLES.find(function(c){return c.id===key;});
    var nome=cab?(cab.nome||'').replace(/ — (ENTRADA|SA[ÍI]DA)$/,'')||rawId:rawId;
    var grupos=cab?cab.grupos:1, fpg=cab?cab.fpg:12;
    var g=Math.floor(fi/fpg)+1, f=(fi%fpg)+1;
    var detail=grupos>1?('Tubo '+g+' · Fibra '+f):('Fibra '+f);
    var color=ABNT[f-1<0?0:(f-1)%12].hex;
    return {tipo:'Cabo',nome:nome+side,detail:detail,color:color,eidKey:eid,fi:fi};
  }
  if(eid.indexOf('in:')===0||eid.indexOf('out:')===0){
    var sid=eid.replace(/^(in|out):/,'');
    var child=ELEM.children.find(function(s){return s.id===sid;});
    var tipos={cto:'CTO',emenda:'Emenda',deriv:'Derivação',olt:'OLT'};
    var t=child?(tipos[child.tipo]||child.tipo):'Elemento';
    var nome=child?child.nome||child.id:sid;
    var isOLT=child&&child.tipo==='olt';
    var portWord=isOLT?'PON':'Porta';
    var detail=eid.indexOf('in:')===0?'Entrada':portWord+' '+(fi+1);
    var colors={cto:'#F59E0B',emenda:'#EF4444',deriv:'#8B5CF6',olt:'#06B6D4'};
    var color=child?(colors[child.tipo]||'#888'):'#888';
    return {tipo:t,nome:nome,detail:detail,color:color,eidKey:eid,fi:fi};
  }
  return {tipo:'?',nome:eid,detail:'fi '+fi,color:'#888',eidKey:eid,fi:fi};
}

function findFiberConn(eid,fi){
  return connections.find(function(c){
    return(c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi);
  });
}

function getPeer(conn,eid,fi){
  if(conn.fromId===eid&&conn.fromFi===fi) return {eid:conn.toId,fi:conn.toFi};
  return {eid:conn.fromId,fi:conn.fromFi};
}

function traceFiberPath(startEid,startFi){
  // Caminha APENAS por conexões EXPLÍCITAS feitas pelo usuário.
  // Não atravessa ::I↔::O automaticamente — emenda precisa ser feita explicitamente
  // para que a iluminação propague entre entrada e saída de um cabo.
  var path=[{eid:startEid,fi:startFi}];
  var visited={};
  visited[startEid+':'+startFi]=true;
  var cur={eid:startEid,fi:startFi};
  var safety=0;
  while(safety++<50){
    var c=findFiberConn(cur.eid,cur.fi);
    if(!c)break;
    var nxt=getPeer(c,cur.eid,cur.fi);
    var k=nxt.eid+':'+nxt.fi;
    if(visited[k])break;
    visited[k]=true;
    path.push(nxt);
    cur=nxt;
  }
  return path;
}

// ═══════ Floating card (info de fibra) ═══════
function ensureFloatCard(){
  var fc=document.getElementById('fiber-float');
  if(fc)return fc;
  fc=document.createElement('div');fc.id='fiber-float';fc.className='fiber-float';
  document.body.appendChild(fc);
  document.addEventListener('mousedown',function(e){
    if(!fc.contains(e.target)&&!e.target.closest('.fdot'))hideFiberInfo();
  });
  return fc;
}
function hideFiberInfo(){var fc=document.getElementById('fiber-float');if(fc){fc.classList.remove('on','centered');fc.style.transform='';}}
function showFiberInfo(eid,fi,dotEl){
  var fc=ensureFloatCard();
  var me=describeEndpoint(eid,fi);
  var conn=findFiberConn(eid,fi);
  var isRemote=conn&&conn._remote;
  var html='<div class="ff-hdr" style="background:'+me.color+';color:'+(lightness(me.color)>160?'#000':'#fff')+'"><b>'+escH(me.tipo+' '+me.nome)+'</b><span>'+escH(me.detail)+'</span></div>';
  if(conn){
    var peer=getPeer(conn,eid,fi);
    var pd=describeEndpoint(peer.eid,peer.fi);
    var statusColor=isRemote?'#06B6D4':'#10B981';
    var statusText=isRemote?'Conectada em outro local':'Conectada (aqui)';
    html+='<div class="ff-row"><span class="ff-lbl">Status:</span> <b style="color:'+statusColor+'">'+statusText+'</b></div>';
    if(isRemote){
      html+='<div class="ff-row"><span class="ff-lbl">Em:</span> <b style="color:#06B6D4">'+(conn._ownerNome||conn._ownerId)+'</b></div>';
    }
    html+='<div class="ff-row"><span class="ff-lbl">Conectada a:</span></div>';
    html+='<div class="ff-peer" style="border-left:3px solid '+pd.color+'"><b>'+escH(pd.tipo+' '+pd.nome)+'</b><br><span>'+escH(pd.detail)+'</span></div>';
  }else{
    html+='<div class="ff-row"><span class="ff-lbl">Status:</span> <b style="color:#9ca3af">Disponível</b></div>';
  }
  html+='<div class="ff-actions">';
  html+='<button class="ff-btn" onclick="showFiberPath(\\''+eid+'\\','+fi+')">▸ Ver caminho completo</button>';
  if(conn&&!isRemote) html+='<button class="ff-btn warn" onclick="removeFiberConn(\\''+eid+'\\','+fi+')">✕ Remover ligação</button>';
  if(isRemote) html+='<div class="ff-info">💡 Para remover esta conexão, abra o diagrama de <b>'+(conn._ownerNome||conn._ownerId)+'</b></div>';
  html+='<button class="ff-btn" onclick="hideFiberInfo()">Fechar</button>';
  html+='</div>';
  fc.innerHTML=html;
  // posiciona perto do dot
  var r=dotEl.getBoundingClientRect();
  var x=r.right+8, y=r.top;
  if(x+280>window.innerWidth) x=r.left-280-8;
  if(y+200>window.innerHeight) y=window.innerHeight-210;
  if(y<8)y=8;
  fc.style.left=x+'px';fc.style.top=y+'px';
  fc.classList.add('on');
}

function removeFiberConn(eid,fi){
  // Remove apenas LOCAL — remotas pertencem a outros elementos
  var idx=connections.findIndex(function(c){return !c._remote&&((c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi));});
  if(idx>=0){connections.splice(idx,1);markUnsaved();updateAll();sbMsg('Conexão removida');}
  else{sbMsg('Esta fibra não tem conexão LOCAL neste diagrama');}
  hideFiberInfo();
}

function showFiberPath(eid,fi){
  hideFiberInfo();
  // Tenta rota GLOBAL via opener (inclui OLT, todos os hops em outros postes/armários)
  var globalHops=null, decode=null, oltHop=null;
  try{
    if(window.opener&&typeof window.opener.traceFiberGlobal==='function'&&typeof window.opener.decodeGlobalEndpoint==='function'){
      globalHops=window.opener.traceFiberGlobal(eid,fi);
      decode=window.opener.decodeGlobalEndpoint;
      // Reordena: coloca a OLT no topo se houver
      for(var gi=0;gi<globalHops.length;gi++){
        if(globalHops[gi].eid.indexOf('out:')===0){
          var sid=globalHops[gi].eid.slice(4);
          var info=decode(globalHops[gi].eid,globalHops[gi].fi);
          if(info.ref&&info.ref.tipo==='olt'){oltHop=globalHops[gi];break;}
        }
      }
    }
  }catch(_){}

  var fc=ensureFloatCard();
  var hops='';
  var totalElems=0, connCount=0;

  if(globalHops&&globalHops.length){
    // Cabeçalho com OLT em destaque (se encontrada)
    if(oltHop){
      var od=decode(oltHop.eid,oltHop.fi);
      hops+='<div style="margin:0 0 10px 0;padding:10px 12px;background:linear-gradient(135deg,#06b6d4,#0d9488);border-radius:8px;color:#fff;box-shadow:0 3px 10px rgba(6,182,212,.45)">';
      hops+='<div style="font-size:11px;opacity:.9;font-weight:600;margin-bottom:2px">💡 ORIGEM DO SINAL</div>';
      hops+='<div style="font-size:14px;font-weight:800;font-family:monospace">'+escH(od.nome)+'</div>';
      hops+='<div style="font-size:11px;opacity:.95;font-weight:600">'+escH(od.detail)+'</div>';
      hops+='</div>';
    }
    totalElems=globalHops.length;
    connCount=globalHops.filter(function(h){return !h.viaCable;}).length-1;
    if(connCount<0)connCount=0;
    for(var i=0;i<globalHops.length;i++){
      var h=globalHops[i];
      var d=decode(h.eid,h.fi);
      var prev=i>0?globalHops[i-1]:null;
      var via=h.viaCable?'⤓ passa pelo cabo':(prev?'↔ conectado a':'');
      var isOLT=d.ref&&d.ref.tipo==='olt';
      if(via)hops+='<div class="ff-hop-arrow">'+via+'</div>';
      hops+='<div class="ff-hop"><div class="ff-hop-num"'+(isOLT?' style="background:#06b6d4"':'')+'>'+(i+1)+'</div>';
      hops+='<div class="ff-hop-info" style="border-left:3px solid '+d.color+(isOLT?';background:#ecfeff':'')+'"><b>'+escH(d.tipo+' '+d.nome)+'</b><br><span>'+escH(d.detail)+'</span></div></div>';
    }
  }else{
    // Fallback: rota LOCAL (apenas neste diagrama)
    var path=traceFiberPath(eid,fi);
    totalElems=path.length;
    connCount=path.length-1;
    for(var li=0;li<path.length;li++){
      var p=describeEndpoint(path[li].eid,path[li].fi);
      var arrow=li<path.length-1?(path[li].eid.split('::')[0]===path[li+1].eid.split('::')[0]&&path[li].fi===path[li+1].fi?'⤓ passa pelo cabo':'↔ conectado a'):'';
      hops+='<div class="ff-hop"><div class="ff-hop-num">'+(li+1)+'</div>';
      hops+='<div class="ff-hop-info" style="border-left:3px solid '+p.color+'"><b>'+escH(p.tipo+' '+p.nome)+'</b><br><span>'+escH(p.detail)+'</span></div></div>';
      if(arrow)hops+='<div class="ff-hop-arrow">'+arrow+'</div>';
    }
  }

  var html='<div class="ff-hdr" style="background:#0d6b50;color:#fff"><b>🔍 Caminho completo da fibra</b><span>'+connCount+' hop(s) · '+totalElems+' elemento(s)</span></div>';
  html+='<div class="ff-path">'+hops+'</div>';
  html+='<div class="ff-actions"><button class="ff-btn" onclick="hideFiberInfo()">Fechar</button></div>';
  fc.innerHTML=html;
  fc.style.left='50%';fc.style.top='80px';
  fc.classList.add('on','centered');
}

var _lastFiberClick={eid:null,fi:null,t:0,timer:null};
function finishFiber(targetDot){
  if(!fdrag)return;
  var src=fdrag;fdrag=null;
  src.el.classList.remove('drag-src');clearPreview();hideTip();
  if(!targetDot||targetDot===src.el){
    if(!src.moved){
      // Click sem drag: detecta single vs double click
      var now=Date.now();
      if(_lastFiberClick.eid===src.eid&&_lastFiberClick.fi===src.fi&&(now-_lastFiberClick.t)<450){
        // Double click → mostra caminho completo
        if(_lastFiberClick.timer){clearTimeout(_lastFiberClick.timer);_lastFiberClick.timer=null;}
        _lastFiberClick={eid:null,fi:null,t:0,timer:null};
        hideFiberInfo();
        showFiberPath(src.eid,src.fi);
      }else{
        // Single click → agenda info card (pode ser cancelado se vier double-click)
        _lastFiberClick={eid:src.eid,fi:src.fi,t:now,timer:setTimeout(function(){
          showFiberInfo(src.eid,src.fi,src.el);
          _lastFiberClick={eid:null,fi:null,t:0,timer:null};
        },280)};
      }
    }
    return;
  }
  // Caiu sobre outra fibra → só conecta se editMode estiver ATIVO
  if(!editMode){
    sbMsg('🔒 Ative o Modo Edição para criar conexões');
    return;
  }
  var tEid=targetDot.dataset.eid,tFi=parseInt(targetDot.dataset.fi);
  if(src.eid===tEid&&src.fi===tFi)return;
  // Bloqueia self-loop em CTO/Deriv/OLT/MPLS: in:X ↔ out:X do MESMO elemento
  // não faz sentido físico e pode causar trace inconsistente via splitter.
  var srcSid=src.eid.replace(/^(in|out):/,'');
  var tSid=tEid.replace(/^(in|out):/,'');
  if(srcSid===tSid&&srcSid!==src.eid&&tSid!==tEid){
    sbMsg('⚠ Não é possível conectar entrada e saída do mesmo elemento');
    return;
  }
  var ex=connections.findIndex(function(c){
    return(c.fromId===src.eid&&c.fromFi===src.fi&&c.toId===tEid&&c.toFi===tFi)||
           (c.fromId===tEid&&c.fromFi===tFi&&c.toId===src.eid&&c.toFi===src.fi);
  });
  if(ex>=0){connections.splice(ex,1);sbMsg('Conexão removida');markUnsaved();updateAll();return;}
  if(isLocalConn(src.eid,src.fi)){
    sbMsg('⚠ Fibra de origem já tem conexão LOCAL — remova antes');
    return;
  }
  if(isLocalConn(tEid,tFi)){
    sbMsg('⚠ Fibra de destino já tem conexão LOCAL — remova antes');
    return;
  }
  connections.push({fromId:src.eid,fromFi:src.fi,toId:tEid,toFi:tFi});
  sbMsg('✓ Fibras conectadas');
  // Auto-renomeia Derivação/CTO quando seu input acaba de receber sinal de uma OLT
  tryAutoNameByOLT(src.eid);
  tryAutoNameByOLT(tEid);
  markUnsaved();updateAll();
}

// Se eid for "in:DERIV-X" ou "in:CTO-X" e a conexão rastrear até uma OLT,
// renomeia o elemento para "<NomeOLT> PON-N" — apenas se o nome atual seguir
// o padrão auto-gerado (não sobrescreve nomes personalizados).
function tryAutoNameByOLT(eid){
  if(!eid||eid.indexOf('in:')!==0)return;
  var sid=eid.slice(3);
  if(!window.opener)return;
  var op=window.opener;
  // Apenas Derivações são auto-renomeadas. CTOs mantêm o nome definido pelo usuário
  // (CTO pode identificar visualmente que pertence ao grupo OLT-X PON-Y via badge).
  var arr=null,prefix=null;
  if(op.derivs&&op.derivs.find(function(d){return d.id===sid;})){arr=op.derivs;prefix='Derivação ';}
  if(!arr)return;
  var el=arr.find(function(d){return d.id===sid;});
  if(!el)return;
  // Considera nome auto-gerado se igual ao id, ou se for "Derivação D##"/"CTO CTO-##"
  var nm=el.nome||'';
  var autoLike=(nm===el.id)||(nm===prefix+el.id)||/^(Derivação D\d+|CTO CTO-\d+|D\d+|CTO-\d+)$/.test(nm);
  if(!autoLike)return;
  // Acha conexão recém-criada local: in:sid fi=0 → cable
  var conn=connections.find(function(c){return (c.fromId===eid&&c.fromFi===0)||(c.toId===eid&&c.toFi===0);});
  if(!conn)return;
  var peerEid=conn.fromId===eid?conn.toId:conn.fromId;
  var peerFi=conn.fromId===eid?conn.toFi:conn.fromFi;
  if(peerEid.indexOf('cable:')!==0)return;
  var cabId=peerEid.slice(6).replace('::I','').replace('::O','');
  var oltInfo=null;
  try{
    if(typeof op.findOLTForFiber==='function')oltInfo=op.findOLTForFiber(cabId,peerFi);
  }catch(_){}
  if(!oltInfo)return;
  var newName=oltInfo.nome+' · PON-'+oltInfo.pon;
  // Garante unicidade no escopo global (usa uniqueName do opener se disponível)
  if(typeof op.uniqueName==='function'){
    try{newName=op.uniqueName(newName,el);}catch(_){}
  }
  el.nome=newName;
  // Atualiza header do painel deste elemento no diagrama, se renderizado
  var panel=document.querySelector('.panel[data-pid="child:'+sid+'"]');
  if(panel){
    var ltxt=panel.querySelector('.cv-ltxt');
    if(ltxt){
      var ports=el.portas||el.capacidade||8;
      ltxt.textContent=newName+' · '+ports+' portas';
      ltxt.title=newName;
    }
  }
  // Notifica opener (refresh ícones/lista)
  try{
    if(typeof op.refreshPosteIcon==='function'&&el.parentId){
      var par=op.findById?op.findById(el.parentId):null;
      if(par)op.refreshPosteIcon(par);
    }
    if(typeof op.debouncedUpdList==='function')op.debouncedUpdList();
    if(typeof op.scheduleAutosave==='function')op.scheduleAutosave();
  }catch(_){}
  sbMsg('✓ Renomeado automaticamente: '+newName);
}

// ── SVG ──────────────────────────────────────────────────────────
function getDotPos(dot){
  var ir=document.getElementById('inner').getBoundingClientRect();
  var dr=dot.getBoundingClientRect();
  return{x:(dr.left-ir.left+dr.width/2)/panScale, y:(dr.top-ir.top+dr.height/2)/panScale};
}
var selectedConnIdx=-1;
function clearLit(){
  document.querySelectorAll('.fdot.lit').forEach(function(d){d.classList.remove('lit');});
}
function lightPathFrom(eid,fi){
  // Ilumina todas as fibras alcançáveis a partir deste endpoint (rota completa)
  if(typeof traceFiberPath!=='function')return;
  try{
    var path=traceFiberPath(eid,fi);
    path.forEach(function(p){
      var d=document.querySelector('.fdot[data-eid="'+p.eid+'"][data-fi="'+p.fi+'"]');
      if(d)d.classList.add('lit');
    });
  }catch(_){}
}
function selectConn(idx){
  selectedConnIdx=idx;
  var btn=document.getElementById('btn-remove-conn');
  if(btn)btn.style.display=idx>=0?'':'none';
  var paths=document.querySelectorAll('.cpath');
  paths.forEach(function(p,i){p.classList.toggle('sel',i===idx);});
  // Limpa iluminação anterior — só acende quando uma conexão está selecionada
  clearLit();
  if(idx>=0){
    var c=connections[idx];
    var fe=document.querySelector('.fdot[data-eid="'+c.fromId+'"][data-fi="'+c.fromFi+'"]');
    var te=document.querySelector('.fdot[data-eid="'+c.toId+'"][data-fi="'+c.toFi+'"]');
    // Ilumina rota completa em ambas as direções a partir da conexão
    lightPathFrom(c.fromId,c.fromFi);
    lightPathFrom(c.toId,c.toFi);
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
// Verifica se o endpoint (out:X ou in:X) pertence a um MPLS — usado para colorir
// as linhas de conexão envolvendo MPLS em vermelho.
function isMPLSEndpoint(eid){
  if(!eid||(eid.indexOf('out:')!==0&&eid.indexOf('in:')!==0))return false;
  var sid=eid.replace(/^(in|out):/,'');
  // Procura nos children deste diagrama
  var child=ELEM&&ELEM.children&&ELEM.children.find(function(s){return s.id===sid;});
  return !!(child&&child.tipo==='mpls');
}
// Cria marcador SVG na ponta da conexão com FORMATO baseado no tipo de endpoint:
//  - OLT/MPLS output:  seta cheia (►) = emissor de sinal
//  - input (in:CTO/Deriv): círculo aberto (○) = receptor
//  - cable: quadradinho (▪) = passagem fibra
//  - emenda (out: de emenda): losango (◆) = splice
function _endpointMarker(eid,pos,color){
  var SVG_NS='http://www.w3.org/2000/svg';
  var g=document.createElementNS(SVG_NS,'g');
  g.setAttribute('class','cendp');
  g.setAttribute('transform','translate('+pos.x+','+pos.y+')');
  g.setAttribute('pointer-events','none');
  var kind='circle';
  if(eid.indexOf('out:')===0){
    // Identifica se é OLT/MPLS (emissor de sinal) ou emenda/CTO/Deriv (saída de splitter)
    var sid=eid.slice(4);
    var child=ELEM&&ELEM.children&&ELEM.children.find(function(s){return s.id===sid;});
    if(child){
      if(child.tipo==='olt'||child.tipo==='mpls')kind='arrow';
      else if(child.tipo==='emenda')kind='diamond';
      else kind='dot'; // CTO/Deriv output = dot pequeno
    }else kind='dot';
  }else if(eid.indexOf('in:')===0){
    kind='ring'; // entrada = anel (recepção)
  }else if(eid.indexOf('cable:')===0){
    kind='square'; // cabo = quadradinho
  }
  var shape;
  if(kind==='arrow'){
    shape=document.createElementNS(SVG_NS,'path');
    shape.setAttribute('d','M -5,-4 L 5,0 L -5,4 Z');
    shape.setAttribute('fill',color);shape.setAttribute('stroke','#fff');shape.setAttribute('stroke-width','1.2');
  }else if(kind==='ring'){
    shape=document.createElementNS(SVG_NS,'circle');
    shape.setAttribute('r','5');
    shape.setAttribute('fill','#fff');shape.setAttribute('stroke',color);shape.setAttribute('stroke-width','2.2');
  }else if(kind==='diamond'){
    shape=document.createElementNS(SVG_NS,'path');
    shape.setAttribute('d','M 0,-5 L 5,0 L 0,5 L -5,0 Z');
    shape.setAttribute('fill',color);shape.setAttribute('stroke','#fff');shape.setAttribute('stroke-width','1.2');
  }else if(kind==='square'){
    shape=document.createElementNS(SVG_NS,'rect');
    shape.setAttribute('x','-3.5');shape.setAttribute('y','-3.5');
    shape.setAttribute('width','7');shape.setAttribute('height','7');
    shape.setAttribute('fill',color);shape.setAttribute('stroke','#fff');shape.setAttribute('stroke-width','1.2');
  }else if(kind==='dot'){
    shape=document.createElementNS(SVG_NS,'circle');
    shape.setAttribute('r','3');
    shape.setAttribute('fill',color);shape.setAttribute('stroke','#fff');shape.setAttribute('stroke-width','1');
  }else{
    shape=document.createElementNS(SVG_NS,'circle');
    shape.setAttribute('r','4');
    shape.setAttribute('fill',color);shape.setAttribute('stroke','#fff');shape.setAttribute('stroke-width','1.5');
  }
  g.appendChild(shape);
  return g;
}

function drawSVG(){
  var svg=document.getElementById('svg-layer');
  svg.querySelectorAll('.cpath,.cendp').forEach(function(p){p.remove();});
  var prev=document.getElementById('prev-path');
  if(selectedConnIdx>=connections.length)selectedConnIdx=-1;
  connections.forEach(function(conn,i){
    // ISOLAMENTO: não desenha linha pra conexão remota (feita em outro elemento)
    if(conn._remote)return;
    var fe=document.querySelector('.fdot[data-eid="'+conn.fromId+'"][data-fi="'+conn.fromFi+'"]');
    var te=document.querySelector('.fdot[data-eid="'+conn.toId+'"][data-fi="'+conn.toFi+'"]');
    if(!fe||!te)return;
    var fp=getDotPos(fe),tp=getDotPos(te);
    var mx=(fp.x+tp.x)/2;
    var fpath=fe.querySelector('.fhx');
    var tpath=te.querySelector('.fhx');
    var fColor=fpath?fpath.getAttribute('fill'):'#3B82F6';
    var tColor=tpath?tpath.getAttribute('fill'):'#3B82F6';
    // Linha de conexão fica vermelha APENAS quando um dos endpoints é DIRETAMENTE
    // um MPLS (out:MPLS-X ou in:MPLS-X) — o que só acontece no diagrama do armário
    // onde o MPLS está. Em emendas locais em outros postes, a linha usa a cor da
    // fibra (mesmo que via upstream chain alcance MPLS). Isso evita confusão tipo
    // "fiz emenda da fi-5 → ficou vermelha" quando fi-5 não foi cross-spliced
    // diretamente com fibra MPLS.
    var fIsMPLS=isMPLSEndpoint(conn.fromId);
    var tIsMPLS=isMPLSEndpoint(conn.toId);
    var lineColor=(fIsMPLS||tIsMPLS)?'#EF4444':fColor;
    var path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('class','cpath'+(i===selectedConnIdx?' sel':'')+((fIsMPLS||tIsMPLS)?' cpath-mpls':''));
    path.setAttribute('d','M'+fp.x+','+fp.y+' C'+mx+','+fp.y+' '+mx+','+tp.y+' '+tp.x+','+tp.y);
    if(i!==selectedConnIdx)path.setAttribute('stroke',lineColor);
    path.addEventListener('click',(function(idx){return function(e){e.stopPropagation();selectConn(idx===selectedConnIdx?-1:idx);};})(i));
    svg.insertBefore(path,prev);
    // Detecta loop (retorno): mesmo elemento dos dois lados
    var fSid=conn.fromId.replace(/^(in|out):/,'');
    var tSid=conn.toId.replace(/^(in|out):/,'');
    var isLoop=(fSid===tSid&&fSid!==conn.fromId&&tSid!==conn.toId);
    if(isLoop)path.classList.add('cpath-loop');
    // Marcadores ricos por tipo de endpoint
    var fMark=_endpointMarker(conn.fromId,fp,fColor);
    var tMark=_endpointMarker(conn.toId,tp,tColor);
    [fMark,tMark].forEach(function(m){if(m)svg.insertBefore(m,prev);});
  });
  // Conexões órfãs (apenas detectar e marcar via desenho separado se for o caso)
  connections.forEach(function(conn){
    if(conn._remote)return;
    var fe=document.querySelector('.fdot[data-eid="'+conn.fromId+'"][data-fi="'+conn.fromFi+'"]');
    var te=document.querySelector('.fdot[data-eid="'+conn.toId+'"][data-fi="'+conn.toFi+'"]');
    // Se um dos endpoints não existe no diagrama: marca o que EXISTE com X de "desconectado"
    var existing=null,missing=null;
    if(fe&&!te){existing=fe;missing=conn.toId;}
    else if(te&&!fe){existing=te;missing=conn.fromId;}
    if(!existing)return;
    var pos=getDotPos(existing);
    var SVG_NS='http://www.w3.org/2000/svg';
    var g=document.createElementNS(SVG_NS,'g');
    g.setAttribute('class','cendp cendp-disconnect');
    g.setAttribute('transform','translate('+(pos.x+12)+','+pos.y+')');
    g.setAttribute('pointer-events','none');
    var x1=document.createElementNS(SVG_NS,'path');
    x1.setAttribute('d','M -4,-4 L 4,4 M 4,-4 L -4,4');
    x1.setAttribute('stroke','#EF4444');x1.setAttribute('stroke-width','2.4');x1.setAttribute('fill','none');x1.setAttribute('stroke-linecap','round');
    g.appendChild(x1);
    var title=document.createElementNS(SVG_NS,'title');
    title.textContent='Endpoint órfão: '+missing;
    g.appendChild(title);
    svg.insertBefore(g,prev);
  });
  document.getElementById('sb-cnt').textContent=connections.length+(connections.length===1?' conexão':' conexões');
  var btn=document.getElementById('btn-remove-conn');
  if(btn)btn.style.display=selectedConnIdx>=0?'':'none';
}
// Fallback local — usa o array connections do popup (locais + remotas) para
// rastrear fonte upstream quando window.opener.findSourceForFiber não está
// disponível (COOP/COEP, popup órfão, etc).
function localTraceSource(startEid,startFi){
  try{
    var visited={};visited[startEid+':'+startFi]=true;
    var queue=[{eid:startEid,fi:startFi}];
    var safety=0;
    while(queue.length&&safety++<500){
      var cur=queue.shift();
      // Passagem ::I↔::O do mesmo cabo na MESMA fibra física
      var pair=null;
      if(cur.eid.indexOf('::I')>=0)pair=cur.eid.replace('::I','::O');
      else if(cur.eid.indexOf('::O')>=0)pair=cur.eid.replace('::O','::I');
      if(pair){
        var pk=pair+':'+cur.fi;
        if(!visited[pk]){visited[pk]=true;queue.push({eid:pair,fi:cur.fi});}
      }
      // Procura conexões neste endpoint (locais + remotas)
      for(var i=0;i<connections.length;i++){
        var c=connections[i];
        var peer=null;
        if(c.fromId===cur.eid&&c.fromFi===cur.fi)peer={eid:c.toId,fi:c.toFi};
        else if(c.toId===cur.eid&&c.toFi===cur.fi)peer={eid:c.fromId,fi:c.fromFi};
        if(peer){
          var k=peer.eid+':'+peer.fi;
          if(!visited[k]){
            visited[k]=true;
            // Detecta fonte direta (out: de OLT/MPLS)
            if(peer.eid.indexOf('out:')===0){
              var sid=peer.eid.slice(4);
              var ch=ELEM.children.find(function(s){return s.id===sid;});
              if(ch&&(ch.tipo==='olt'||ch.tipo==='mpls')){
                return {tipo:ch.tipo,nome:ch.nome||ch.id,pon:peer.fi+1};
              }
            }
            queue.push(peer);
          }
        }
      }
    }
  }catch(_){}
  return null;
}

function resolveFiberSource(eid,fi){
  // 1) Tenta o trace global do main window (mais completo — atravessa multi-elementos)
  try{
    if(window.opener&&typeof window.opener.findSourceForFiber==='function'){
      var cabId=eid.slice(6).replace('::I','').replace('::O','');
      var src=window.opener.findSourceForFiber(cabId,fi);
      if(src)return src;
    }
  }catch(_){}
  // 2) Fallback: trace local usando connections do popup (pega remote+local)
  return localTraceSource(eid,fi);
}

function updateDots(){
  // REGRA (alinhada com MK NetMaps): propagação puramente topológica.
  //   .conn       → conexão LOCAL feita NESTE diagrama (✓ verde)
  //   .upstream-* → fibra carrega sinal de OLT/MPLS (laranja/vermelho)
  //
  // ENTRADA e SAÍDA são tratadas igualmente: ambas acendem se traceFiberGlobal/
  // localTraceSource retornar uma fonte. Cross-splice F-IN↔F-OUT propaga
  // automaticamente porque o trace atravessa ::I↔::O do mesmo cabo.
  document.querySelectorAll('.fdot').forEach(function(dot){
    var eid=dot.dataset.eid, fi=parseInt(dot.dataset.fi);
    var local=isLocalConn(eid,fi);
    dot.classList.toggle('conn',local);
    dot.classList.remove('remote-conn');
    dot.classList.remove('upstream-olt');
    dot.classList.remove('upstream-mpls');
    delete dot.dataset.dotTitleRemote;
    delete dot.dataset.dotTitleUpstream;
    if(eid.indexOf('cable:')!==0)return; // só fibras de cabo
    // Resolve fonte upstream — sem distinção entrada/saída
    var src=resolveFiberSource(eid,fi);
    if(src){
      dot.classList.add(src.tipo==='mpls'?'upstream-mpls':'upstream-olt');
      dot.dataset.dotTitleUpstream=src.tipo.toUpperCase()+' '+src.nome+(src.tipo==='olt'?' · PON '+src.pon:'');
    }
  });
  // Reaplica iluminação se houver conexão selecionada válida; senão limpa
  clearLit();
  if(selectedConnIdx>=0&&selectedConnIdx<connections.length){
    var c=connections[selectedConnIdx];
    if(c){
      lightPathFrom(c.fromId,c.fromFi);
      lightPathFrom(c.toId,c.toFi);
    }
  }
}
function updateAll(){updateDots();drawSVG();}

// ── Tooltip ──────────────────────────────────────────────────────
function showTip(dot,cx,cy){
  var tip=document.getElementById('tip');
  var eid=dot.dataset.eid, fi=parseInt(dot.dataset.fi);
  var lines=['<strong>'+dot.dataset.dotTitle+'</strong>'];
  // Procura TODAS conexões dessa fibra (locais + remotas)
  var localConn=null, remoteConn=null;
  connections.forEach(function(c){
    if((c.fromId===eid&&c.fromFi===fi)||(c.toId===eid&&c.toFi===fi)){
      if(c._remote)remoteConn=c;
      else localConn=c;
    }
  });
  // Rastreia origem do sinal (OLT/MPLS). Mostra em:
  //   - Fibra com conexão local (técnico fez emenda aqui)
  //   - Fibra com conexão remota (emenda feita em outro elemento)
  //   - Fibra de passagem com upstream marcado (carrega sinal sem emenda local)
  var hasUpstream=dot.classList.contains('upstream-olt')||dot.classList.contains('upstream-mpls');
  var oltInfo=null, sourceInfo=null;
  if(eid.indexOf('cable:')===0&&(localConn||remoteConn||hasUpstream)){
    var cabId=eid.slice(6).replace('::I','').replace('::O','');
    try{
      if(window.opener&&typeof window.opener.findSourceForFiber==='function'){
        sourceInfo=window.opener.findSourceForFiber(cabId,fi);
        if(sourceInfo&&sourceInfo.tipo==='olt')oltInfo={nome:sourceInfo.nome,pon:sourceInfo.pon};
      }else if(window.opener&&window.opener.findOLTForFiber){
        oltInfo=window.opener.findOLTForFiber(cabId,fi);
        if(oltInfo)sourceInfo={tipo:'olt',nome:oltInfo.nome,pon:oltInfo.pon};
      }
    }catch(_){}
  }
  if(localConn){
    var oid=localConn.fromId===eid&&localConn.fromFi===fi?localConn.toId:localConn.fromId;
    var ofi=localConn.fromId===eid&&localConn.fromFi===fi?localConn.toFi:localConn.fromFi;
    var od=document.querySelector('.fdot[data-eid="'+oid+'"][data-fi="'+ofi+'"]');
    lines.push('<span style="color:#10B981">● Conectada aqui ⇔ '+(od?od.dataset.dotTitle:oid+'#'+ofi)+'</span>');
  }
  if(remoteConn){
    var rOwner=remoteConn._ownerNome||remoteConn._ownerId||'outro elemento';
    var rPeerEid=remoteConn.fromId===eid&&remoteConn.fromFi===fi?remoteConn.toId:remoteConn.fromId;
    var rPeerFi=remoteConn.fromId===eid&&remoteConn.fromFi===fi?remoteConn.toFi:remoteConn.fromFi;
    var peerDesc=rPeerEid;
    if(rPeerEid.indexOf('out:')===0||rPeerEid.indexOf('in:')===0){
      var sid=rPeerEid.replace(/^(in|out):/,'');
      var child=ELEM.children.find(function(s){return s.id===sid;});
      // Children são deste elemento; se a remote-conn aponta pra child, talvez não conheçamos. Use ID.
      peerDesc=(rPeerEid.indexOf('out:')===0?'porta ':'entrada ')+(rPeerFi+1)+' de '+sid;
    }
    lines.push('<span style="color:#06B6D4">🌐 Conectada em '+rOwner+'</span>');
    lines.push('<span style="color:#06B6D4;font-size:9px">↳ '+peerDesc+'</span>');
  }
  if(sourceInfo){
    var isMplsSrc=sourceInfo.tipo==='mpls';
    var grad=isMplsSrc?'linear-gradient(135deg,#EF4444,#991b1b)':'linear-gradient(135deg,#06b6d4,#0d9488)';
    var shad=isMplsSrc?'rgba(239,68,68,.5)':'rgba(6,182,212,.5)';
    // OLT mostra "Sinal de OLT X · PON N" (identifica a porta de origem).
    // MPLS é só identificador — não detalha qual fibra do MPLS está alimentando.
    var head=isMplsSrc
      ? '<span style="font-size:14px">💡</span> Sinal vindo do <b style="font-family:monospace">MPLS '+escH(sourceInfo.nome)+'</b>'
      : '<span style="font-size:14px">💡</span> Sinal de <b style="font-family:monospace">OLT '+escH(sourceInfo.nome)+'</b><br><span style="font-size:10px;font-weight:600;opacity:.95">PON '+sourceInfo.pon+'</span>';
    lines.push('<div style="margin-top:6px;padding:8px 10px;background:'+grad+';border-radius:6px;color:#fff;font-weight:700;font-size:11px;line-height:1.35;box-shadow:0 2px 8px '+shad+'">'+head+'</div>');
  }
  if(!localConn&&!remoteConn&&!sourceInfo){
    lines.push('<span style="color:#9ca3af">Dispon\xEDvel — arraste para conectar</span>');
  }else if(!localConn&&(remoteConn||sourceInfo)){
    lines.push('<span style="color:#fbbf24;font-size:9px">↪ Você ainda pode conectar a outra fibra aqui</span>');
  }
  tip.innerHTML=lines.join('<br>');tip.classList.add('on');
  tip.style.left=Math.min(cx+14,window.innerWidth-260)+'px';
  tip.style.top=Math.min(cy-10,window.innerHeight-120)+'px';
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
  // Salva apenas conexões LOCAIS (remotas pertencem a outros elementos)
  var localOnly=connections.filter(function(c){return !c._remote;});
  if(window.opener&&window.opener._fiberDiagramSave)
    window.opener._fiberDiagramSave(localOnly,(function(){var r={};for(var k in positions)r[k]={x:positions[k].x,y:positions[k].y};return r;})());
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
function askRemoveAllConns(){
  if(!editMode){sbMsg('⚠ Ative o Modo Edi\xE7\xE3o primeiro');return;}
  if(connections.length===0){sbMsg('N\xE3o h\xE1 conex\xF5es para remover');return;}
  if(!confirm('Remover TODAS as '+connections.length+' liga\xE7\xF5es do diagrama?'))return;
  connections=[];selectConn(-1);markUnsaved();updateAll();sbMsg('✓ Todas as liga\xE7\xF5es removidas');
}
function toggleEditMode(){
  editMode=!editMode;
  document.body.classList.toggle('edit-mode',editMode);
  var btn=document.getElementById('btn-edit-mode');
  if(btn){
    btn.innerHTML=editMode?'&#x1F512; Modo Visualiza&ccedil;&atilde;o':'&#x270F;&#xFE0F; Modo Edi&ccedil;&atilde;o';
    btn.className='tbtn '+(editMode?'amber':'');
  }
  // Esconde botão "Remover ligação" se sair do modo edição
  if(!editMode){selectConn(-1);}
  sbMsg(editMode?'✏️ Modo Edi\xE7\xE3o ATIVO — arraste fibras para conectar':'🔒 Modo Visualiza\xE7\xE3o — clique nas fibras para ver dados, click duplo para caminho');
}
function showCloseConf(){document.getElementById('close-conf-overlay').style.display='flex';}
function hideCloseConf(){document.getElementById('close-conf-overlay').style.display='none';}
function requestClose(){
  if(_saved){window.close();return;}
  showCloseConf();
}

// ── Navegação anterior/próximo diagrama ─────────────────────────
function _doNav(target){
  if(!target||!window.opener||typeof window.opener.navigateDiagram!=='function')return;
  function go(){
    try{window.opener.navigateDiagram(window,target.id);}catch(e){console.error('Nav falhou:',e);}
  }
  if(!_saved){
    // Pergunta antes de descartar
    if(confirm('Há alterações não salvas. Deseja salvar antes de navegar?')){doSave();setTimeout(go,200);}
    else{_saved=true;go();}
  }else go();
}
function navPrevDiagram(){var n=DATA&&DATA.neighbors;if(n&&n.prev)_doNav(n.prev);}

// ── Versionamento ───────────────────────────────────────────────
function showVersionsModal(){
  refreshVersionsList();
  document.getElementById('ver-overlay').classList.add('on');
}
function closeVersionsModal(){document.getElementById('ver-overlay').classList.remove('on');}
function refreshVersionsList(){
  var list=document.getElementById('ver-list');
  var versions=[];
  try{if(window.opener&&window.opener._diagramVersionsList)versions=window.opener._diagramVersionsList();}catch(_){}
  if(!versions.length){
    list.innerHTML='<div class="ver-empty">Nenhuma versão salva ainda.<br>Use o campo acima pra criar a primeira.</div>';
    return;
  }
  list.innerHTML=versions.map(function(v){
    var dt=new Date(v.ts);
    var dStr=dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    return '<div class="ver-item">'+
      '<div class="ver-item-info"><div class="ver-item-label">'+escH(v.label)+(v.auto?'<span class="ver-item-auto">Auto</span>':'')+'</div>'+
      '<div class="ver-item-meta">'+dStr+' · '+v.connCount+' conexões</div></div>'+
      '<button class="ver-item-btn" onclick="restoreVersion(\\''+v.id+'\\')">▸ Restaurar</button>'+
      '<button class="ver-item-btn warn" onclick="deleteVersion(\\''+v.id+'\\')">🗑</button>'+
      '</div>';
  }).join('');
}
function saveCurrentVersion(){
  var inp=document.getElementById('ver-new-label');
  var label=(inp.value||'').trim()||'Versão '+(new Date()).toLocaleString('pt-BR');
  try{
    if(!window.opener||!window.opener._diagramVersionSave){sbMsg('⚠ Opener fechado, não foi possível salvar');return;}
    var pos={};for(var k in positions)pos[k]={x:positions[k].x,y:positions[k].y};
    window.opener._diagramVersionSave(label,connections,pos,false);
    inp.value='';
    refreshVersionsList();
    sbMsg('✓ Versão salva: '+label);
  }catch(e){sbMsg('Erro: '+(e.message||e));}
}
function restoreVersion(vid){
  if(!confirm('Restaurar esta versão? As alterações não salvas serão perdidas.'))return;
  try{
    // Auto-salva o estado atual antes (snapshot de segurança)
    if(window.opener&&window.opener._diagramVersionSave){
      var pos={};for(var k in positions)pos[k]={x:positions[k].x,y:positions[k].y};
      window.opener._diagramVersionSave('Antes de restaurar — '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),connections,pos,true);
    }
    var v=window.opener._diagramVersionRestore(vid);
    if(!v){sbMsg('Versão não encontrada');return;}
    connections=v.connections||[];
    var newPos=v.positions||{};
    // Limpa e re-renderiza painéis nas novas posições
    Object.keys(newPos).forEach(function(pid){
      var p=panelDom[pid];if(!p)return;
      positions[pid]={x:newPos[pid].x,y:newPos[pid].y};
      p.style.left=newPos[pid].x+'px';
      p.style.top=newPos[pid].y+'px';
    });
    markUnsaved();updateAll();
    closeVersionsModal();
    sbMsg('✓ Versão restaurada — salve para confirmar');
  }catch(e){sbMsg('Erro: '+(e.message||e));}
}
function deleteVersion(vid){
  if(!confirm('Excluir esta versão? Não há como desfazer.'))return;
  try{
    if(window.opener&&window.opener._diagramVersionDelete){
      window.opener._diagramVersionDelete(vid);
      refreshVersionsList();
      sbMsg('Versão removida');
    }
  }catch(e){sbMsg('Erro: '+(e.message||e));}
}
function navNextDiagram(){var n=DATA&&DATA.neighbors;if(n&&n.next)_doNav(n.next);}
// Atalho de teclado Ctrl+← / Ctrl+→
document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if(e.ctrlKey||e.metaKey){
    if(e.key==='ArrowLeft'){e.preventDefault();navPrevDiagram();}
    else if(e.key==='ArrowRight'){e.preventDefault();navNextDiagram();}
  }
});

// ── Export PNG / PDF ─────────────────────────────────────────────
function _captureDiagram(){
  var inner=document.getElementById('inner');
  var panels=inner.querySelectorAll('.panel');
  if(!panels.length)return Promise.reject(new Error('Diagrama vazio'));
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  panels.forEach(function(p){
    var x=parseFloat(p.style.left)||0,y=parseFloat(p.style.top)||0;
    var w=p.offsetWidth,h=p.offsetHeight;
    if(x<minX)minX=x; if(y<minY)minY=y;
    if(x+w>maxX)maxX=x+w; if(y+h>maxY)maxY=y+h;
  });
  var pad=40;
  minX-=pad;minY-=pad;maxX+=pad;maxY+=pad;
  var w=maxX-minX, h=maxY-minY;
  var savedTransform=inner.style.transform;
  var savedOrigin=inner.style.transformOrigin;
  inner.style.transform='translate('+(-minX)+'px,'+(-minY)+'px)';
  inner.style.transformOrigin='0 0';
  var area=document.getElementById('area');
  var savedAreaBg=area.style.backgroundImage;
  area.style.backgroundImage='none';
  // SVG svg-layer tem width/height de 1px — html2canvas não captura conteúdo que
  // extrapola. Ajustamos viewBox e tamanho durante a captura.
  var svg=document.getElementById('svg-layer');
  var savedSvgW=svg.getAttribute('width');
  var savedSvgH=svg.getAttribute('height');
  var savedSvgVB=svg.getAttribute('viewBox');
  var savedSvgStyle=svg.style.cssText;
  svg.setAttribute('width',Math.max(w+minX,1));
  svg.setAttribute('height',Math.max(h+minY,1));
  svg.setAttribute('viewBox','0 0 '+(w+minX)+' '+(h+minY));
  svg.style.width=(w+minX)+'px';
  svg.style.height=(h+minY)+'px';
  // Remove animação durante captura — html2canvas pega frame estático
  var paths=svg.querySelectorAll('.cpath');
  var savedAnim=[];
  paths.forEach(function(p){savedAnim.push(p.style.animation);p.style.animation='none';});
  function restore(){
    inner.style.transform=savedTransform;
    inner.style.transformOrigin=savedOrigin;
    area.style.backgroundImage=savedAreaBg;
    if(savedSvgW===null)svg.removeAttribute('width');else svg.setAttribute('width',savedSvgW);
    if(savedSvgH===null)svg.removeAttribute('height');else svg.setAttribute('height',savedSvgH);
    if(savedSvgVB===null)svg.removeAttribute('viewBox');else svg.setAttribute('viewBox',savedSvgVB);
    svg.style.cssText=savedSvgStyle;
    paths.forEach(function(p,i){p.style.animation=savedAnim[i]||'';});
  }
  return html2canvas(inner.parentElement,{
    backgroundColor:'#ffffff',width:w,height:h,scale:2,logging:false,useCORS:true,
    windowWidth:w,windowHeight:h,
    // foreignObjectRendering ajuda html2canvas a renderizar SVG corretamente
    foreignObjectRendering:false
  }).then(function(canvas){restore();return canvas;}).catch(function(err){restore();throw err;});
}
function _diagramFileName(ext){
  var name=(ELEM.nome||ELEM.id||'diagrama').replace(/[^A-Za-z0-9_\\-]/g,'_');
  var ts=new Date().toISOString().slice(0,10);
  return 'diagrama_'+name+'_'+ts+'.'+ext;
}
function exportDiagramPNG(){
  if(typeof html2canvas==='undefined'){sbMsg('⚠ html2canvas ainda carregando, tente em instantes');return;}
  sbMsg('🖼 Gerando PNG…');
  _captureDiagram().then(function(canvas){
    canvas.toBlob(function(blob){
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=_diagramFileName('png');
      a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
      sbMsg('✓ PNG exportado');
    },'image/png');
  }).catch(function(err){sbMsg('✗ Erro: '+(err.message||err));});
}
function exportDiagramPDF(){
  if(typeof html2canvas==='undefined'||typeof window.jspdf==='undefined'){sbMsg('⚠ Bibliotecas ainda carregando');return;}
  sbMsg('📄 Gerando PDF…');
  _captureDiagram().then(function(canvas){
    var imgData=canvas.toDataURL('image/jpeg',0.92);
    var jsPDF=window.jspdf.jsPDF;
    // Orientação automática — landscape se largura > altura
    var orient=canvas.width>canvas.height?'landscape':'portrait';
    var pdf=new jsPDF({orientation:orient,unit:'mm',format:'a4'});
    var pw=pdf.internal.pageSize.getWidth();
    var ph=pdf.internal.pageSize.getHeight();
    // Cabeçalho
    pdf.setFontSize(13);pdf.setTextColor(20,30,50);
    pdf.text('Diagrama de Fibras — '+(ELEM.nome||ELEM.id),10,10);
    pdf.setFontSize(8);pdf.setTextColor(120);
    pdf.text((ELEM.tipo||'').toUpperCase()+' · '+new Date().toLocaleString('pt-BR'),10,15);
    // Imagem (fit em página)
    var availH=ph-25;
    var availW=pw-20;
    var ratio=Math.min(availW/canvas.width,availH/canvas.height);
    var iw=canvas.width*ratio, ih=canvas.height*ratio;
    pdf.addImage(imgData,'JPEG',(pw-iw)/2,20,iw,ih);
    pdf.save(_diagramFileName('pdf'));
    sbMsg('✓ PDF exportado');
  }).catch(function(err){sbMsg('✗ Erro: '+(err.message||err));});
}
function confirmCloseSave(){
  doSave();
  setTimeout(function(){window.close();},250);
}
function confirmCloseDiscard(){
  // Não salva — fecha. As alterações locais somem porque o opener não foi chamado.
  _saved=true; // evita re-disparar prompt em beforeunload
  hideCloseConf();
  window.close();
}
// beforeunload: também pega tentativas de fechar pelo X da janela
window.addEventListener('beforeunload',function(e){
  if(!_saved){
    e.preventDefault();
    e.returnValue='Há alterações não salvas. Deseja realmente fechar?';
    return e.returnValue;
  }
});
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
    applyPan(0,0);
    // Remove conexões órfãs (apontam pra elementos que não existem mais)
    connections=connections.filter(function(c){
      var a=document.querySelector('.fdot[data-eid="'+c.fromId+'"][data-fi="'+c.fromFi+'"]');
      var b=document.querySelector('.fdot[data-eid="'+c.toId+'"][data-fi="'+c.toFi+'"]');
      return a&&b;
    });
    updateAll();
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
// As implementações canônicas de switchEmTab, closeEmModal, saveProps,
// openAlterarCaboModal, quickAdd, openSubElemModal, selectSubSplit,
// confirmSubModal e closeSubModal vivem em modals.js. Esse arquivo só
// fornece o popup do diagrama; manter duplicatas aqui causou bugs onde
// edições em modals.js (suporte a MPLS, p.ex.) eram silenciosamente
// sobrescritas por versões antigas. NÃO redefinir aqui.

// zoomTo e findById definidos em ui.js

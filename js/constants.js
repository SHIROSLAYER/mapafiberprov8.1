// ═══════════════════════════════════════════════
// constants.js — Constantes, StateManager, Variáveis Globais
// ═══════════════════════════════════════════════

// Versão do app — incrementar quando adicionar novidades pro popup reaparecer
const WELCOME_VERSION = '9.1';

// ═══════════════════ SISTEMA DE UNDO/REDO ═══════════════════
class StateManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxStates = 50;
  }
  pushState(label = 'Ação') {
    this.redoStack = [];
    const state = buildProjectSnapshot();
    state._label = label;
    state._ts = Date.now(); // timestamp para histórico
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxStates) this.undoStack.shift();
    updateUndoRedoUI();
  }
  undo() {
    if (this.undoStack.length === 0) return false;
    const currentState = buildProjectSnapshot();
    currentState._label = '_current'; currentState._ts = Date.now();
    this.redoStack.push(currentState);
    const prevState = this.undoStack.pop();
    applyProjectSnapshot(prevState);
    showToast(`↶ ${prevState._label || 'Ação'}`, 'success');
    updateUndoRedoUI();
    return true;
  }
  redo() {
    if (this.redoStack.length === 0) return false;
    const currentState = buildProjectSnapshot();
    currentState._label = '_current'; currentState._ts = Date.now();
    this.undoStack.push(currentState);
    const nextState = this.redoStack.pop();
    applyProjectSnapshot(nextState);
    showToast(`↷ ${nextState._label || 'Ação'}`, 'success');
    updateUndoRedoUI();
    return true;
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    updateUndoRedoUI();
  }
}

const stateManager = new StateManager();

// ═══════════════════ CONSTANTES E VARIÁVEIS GLOBAIS ═══════════════════
const ABNT=[
  {name:'Verde',       hex:'#2E7D32'},{name:'Amarelo',     hex:'#F9A825'},
  {name:'Branco',      hex:'#F5F5F5'},{name:'Azul',        hex:'#1565C0'},
  {name:'Vermelho',    hex:'#C62828'},{name:'Violeta',     hex:'#6A1B9A'},
  {name:'Marrom',      hex:'#5D4037'},{name:'Rosa',        hex:'#E91E8C'},
  {name:'Preto',       hex:'#212121'},{name:'Cinza',       hex:'#757575'},
  {name:'Laranja',     hex:'#E65100'},{name:'Aqua',        hex:'#00838F'},
];
function abntColor(globalIdx, fpg){
  // fpg = fibras por tubo (default 12). Para cabos 36FO (6T×6F), passa fpg=6.
  fpg = fpg || 12;
  const tubeIdx = Math.floor(globalIdx / fpg);
  const fiberInTube = globalIdx % fpg;
  return {
    fiber: ABNT[fiberInTube % 12],
    tube: ABNT[tubeIdx % 12],
    tubeN: tubeIdx + 1,
    fiberN: fiberInTube + 1,
    global: globalIdx + 1
  };
}

const CABLE_TYPES=[
  {id:'fo-8',   name:'8 FO',    grupos:1,fpg:8,   estilo:'conv', color:'#10B981', desc:'Cabo 8 fibras'},
  {id:'fo-12',  name:'12 FO',   grupos:1,fpg:12,  estilo:'conv', color:'#1D9E75', desc:'Padrão FTTH'},
  {id:'fo-36',  name:'36 FO',   grupos:6,fpg:6,   estilo:'conv', color:'#3B82F6', desc:'6 tubos × 6'},
  {id:'fo-72',  name:'72 FO',   grupos:6,fpg:12,  estilo:'conv', color:'#F97316', desc:'6 tubos × 12'},
  {id:'custom', name:'Custom',  grupos:1,fpg:12,  estilo:'conv', color:'#A78BFA', desc:'Personalizado'},
];

const ATT={fibra:.35,conector:.5,emenda:.1,budget:28};
const SPLITTER_LOSS={'none':0,'1/8':10.5,'1/16':14.0};

let map, mode='select', isDarkMode=true;
let postes=[],ctos=[],emendas=[],derivs=[],cabos=[],connections=[],olts=[],armarios=[],mpls=[];
let drawingCabo=false,caboPoints=[],caboPolyline=null,tempDots=[],pendingCable=null;
let connFirst=null,selectedElem=null;
let pcnt=0,ctocnt=0,emcnt=0,dcnt=0,cabocnt=0,oltcnt=0,armcnt=0,mplscnt=0;
let confCb=null,confCancelCb=null,currentEM=null;
let fiberMode='drag',fiberDragState=null;
let _subPending={tipo:null,parent:null};
let _lastParentForEmendaWarning = null;
let diagramState={offsetX:0,offsetY:0,dragging:null,elements:{}};

// ── Medição ──
let measurePoints=[], measurePolyline=null, measureLabels=[], measurePreviewLine=null;

// ── Geolocalização ──
let geoWatchId=null, geoMarker=null, geoCircle=null;

// ── Tile layer ──
let activeTileLayer=null, currentTileId='osm';

// ── CSV ──

const isMobile=/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
if(isMobile)document.body.classList.add('mobile');

// ═══════════════════ SANITIZAÇÃO HTML / ATRIBUTOS / JS INLINE ═══════════════════
// escH:   escapa texto p/ inserção em conteúdo HTML (e em atributos com aspas duplas)
// escAttr: idem (mantido como alias semântico)
// escJs:  escapa string p/ uso DENTRO de strings JS inline (onclick="foo('${escJs(id)}')")
//         escapa aspas, contra-barras, quebras de linha e o `<` (impede fechamento de </script>)
function escH(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escAttr(s){return escH(s);}
function escJs(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/</g,'\\x3C').replace(/>/g,'\\x3E');}
// safeHTML: tag template — escapa automaticamente todos os interpolados.
// Para inserir HTML cru já pré-renderizado, use new SafeStr(html) ou .__html.
function SafeStr(h){this.__html=String(h);}
function safeHTML(strings, ...values){
  let out=strings[0];
  for(let i=0;i<values.length;i++){
    const v=values[i];
    out += (v&&typeof v==='object'&&'__html'in v)?v.__html:escH(v);
    out += strings[i+1];
  }
  return out;
}


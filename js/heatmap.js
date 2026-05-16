// ═══════════════════════════════════════════════
// heatmap.js — Visualização de atenuação no mapa
// ═══════════════════════════════════════════════
// Pinta os cabos conforme % de atenuação consumida do budget.
// Verde = saudável, amarelo = atenção, vermelho = excede.

let _heatmapOn = false;
let _heatmapOriginalColors = new Map();

function attRatio(c){
  if(typeof calcAtt!=='function')return 0;
  const a=calcAtt(c);
  const budget=(typeof ATT!=='undefined'?ATT.budget:28);
  return a.tot/budget; // 0..1+ onde 1+ excede budget
}

function attColor(ratio){
  // Gradiente: 0 verde → 0.7 amarelo → 1+ vermelho
  if(ratio>=1)return '#dc2626'; // excede
  if(ratio>=0.9)return '#ef4444';
  if(ratio>=0.75)return '#f59e0b';
  if(ratio>=0.5)return '#facc15';
  if(ratio>=0.3)return '#84cc16';
  return '#22c55e';
}

function toggleHeatmap(){
  _heatmapOn=!_heatmapOn;
  applyHeatmap();
  const btn=document.getElementById('btn-heatmap');
  if(btn){
    btn.classList.toggle('act',_heatmapOn);
    btn.textContent=_heatmapOn?'🔥 Heatmap ON':'🔥 Heatmap';
  }
  showToast(_heatmapOn?'🔥 Heatmap ativado — cabos coloridos por atenuação':'Heatmap desativado','info');
  if(_heatmapOn)showHeatmapLegend();else hideHeatmapLegend();
}

function applyHeatmap(){
  cabos.forEach(c=>{
    if(!c.poly)return;
    if(_heatmapOn){
      // Guarda cor original na primeira vez
      if(!_heatmapOriginalColors.has(c.id)){
        _heatmapOriginalColors.set(c.id,c.poly.options.color||c.color||'#1D9E75');
      }
      const ratio=attRatio(c);
      const color=attColor(ratio);
      const weight=4+Math.min(4,ratio*3); // mais grosso quanto pior
      c.poly.setStyle({color:color,weight:weight,opacity:.95});
    }else{
      // Restaura cor original
      if(_heatmapOriginalColors.has(c.id)){
        c.poly.setStyle({color:_heatmapOriginalColors.get(c.id),weight:4,opacity:.9});
      }
    }
  });
}

function refreshHeatmap(){if(_heatmapOn)applyHeatmap();}

function showHeatmapLegend(){
  let el=document.getElementById('heatmap-legend');
  if(!el){
    el=document.createElement('div');el.id='heatmap-legend';el.className='heatmap-legend';
    document.body.appendChild(el);
  }
  el.innerHTML=`
    <div class="hml-title">🔥 Heatmap de Atenuação</div>
    <div class="hml-rows">
      <div class="hml-row"><span class="hml-sw" style="background:#22c55e"></span>OK · &lt;30%</div>
      <div class="hml-row"><span class="hml-sw" style="background:#84cc16"></span>Bom · 30–50%</div>
      <div class="hml-row"><span class="hml-sw" style="background:#facc15"></span>Atenção · 50–75%</div>
      <div class="hml-row"><span class="hml-sw" style="background:#f59e0b"></span>Próximo · 75–90%</div>
      <div class="hml-row"><span class="hml-sw" style="background:#ef4444"></span>Crítico · 90–100%</div>
      <div class="hml-row"><span class="hml-sw" style="background:#dc2626"></span>Excede budget</div>
    </div>`;
  el.style.display='block';
}
function hideHeatmapLegend(){const el=document.getElementById('heatmap-legend');if(el)el.style.display='none';}

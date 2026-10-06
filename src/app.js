/* Visuele laag v3. De animatie gebruikt uitsluitend Model.sample(resultaat,t).
 * Geen vervormings- of breukanimatie van een echte isolator.
 */
(() => {
'use strict';
const M=window.GVBModel, $=id=>document.getElementById(id);
const fmt=(v,d=2)=> (Math.abs(v)<Math.pow(10,-d)/2?0:v).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let params={...M.defaults},referenceParams=null,result=null,reference=null,time=0,running=false,prevStamp=null,holdUntil=0;
let mode='motion',scale=50000,forceScale=1,end=.515,debounce=null,toastTimer=null,plotSeries=[],plotMax=.515,plotLo=-1,plotHi=1;
let dirty=true;
let sweep=null,sweepWorker=null,sweepToken=0,sweepBusy=false,checkWorker=null,checkToken=0,lastProfile=null;
const svgNS='http://www.w3.org/2000/svg';
function sceneTemplate(id){return `<svg viewBox="0 0 460 390" role="img" aria-label="Bewegend equivalent massa–veer–dempermodel">
<defs><pattern id="${id}-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 H 0 V 24" fill="none" stroke="#e5eef2" stroke-opacity=".04"/></pattern></defs>
<rect x="0" y="0" width="460" height="390" fill="url(#${id}-grid)"/>
<line x1="108" y1="105" x2="350" y2="105" stroke="#d6e7ee" stroke-opacity=".25" stroke-dasharray="3 5"/>
<line x1="108" y1="280" x2="350" y2="280" stroke="#d6e7ee" stroke-opacity=".25" stroke-dasharray="3 5"/>
<rect x="125" y="74" width="150" height="62" rx="8" stroke="#e5eef2" stroke-opacity=".18" fill="none" stroke-dasharray="4 5"/>
<path id="${id}-spring" fill="none" stroke="#dce8ee" stroke-width="2.8" stroke-linejoin="round"/>
<path id="${id}-piston" fill="none" stroke="#dce8ee" stroke-width="2.5"/>
<g id="${id}-cylinder"><path d="M-13 -116 L-13 -6 L13 -6 L13 -116" fill="#223742" stroke="#dce8ee" stroke-width="2.2"/><line x1="0" y1="-6" x2="0" y2="0" stroke="#dce8ee" stroke-width="2.2"/></g>
<text x="118" y="218" font-size="15" fill="#c2d4dd" font-style="italic">k</text><text x="262" y="218" font-size="15" fill="#c2d4dd" font-style="italic">c</text>
<g id="${id}-mass"><rect x="125" y="-31" width="150" height="62" rx="8" fill="#f3c892"/><rect x="128" y="-28" width="144" height="5" rx="3" fill="#fff" opacity=".25"/><text x="200" y="-2" text-anchor="middle" fill="#263239" font-size="24" font-style="italic">m</text><text x="200" y="18" text-anchor="middle" fill="#465159" font-size="9">effectieve massa</text></g>
<g id="${id}-basis"><rect x="100" y="0" width="200" height="15" rx="4" fill="#89cddd"/><path d="M105 29 l14 -14 M125 29 l14 -14 M145 29 l14 -14 M165 29 l14 -14 M185 29 l14 -14 M205 29 l14 -14 M225 29 l14 -14 M245 29 l14 -14 M265 29 l14 -14 M285 29 l10 -10" stroke="#89cddd" stroke-width="1.2" opacity=".65"/><text x="200" y="47" text-anchor="middle" fill="#a6dcea" font-size="10">voorgeschreven basisbeweging</text></g>
<path id="${id}-xArrow" fill="none" stroke="#f3c892" stroke-width="1.5"/>
<path id="${id}-yArrow" fill="none" stroke="#89cddd" stroke-width="1.5"/>
<text x="353" y="74" font-size="11" fill="#f3c892">x(t)</text><text id="${id}-xValue" x="353" y="91" font-size="12" fill="#e5eef2" class="diagram-detail">0,00 mm</text>
<text x="353" y="249" font-size="11" fill="#89cddd">y(t)</text><text id="${id}-yValue" x="353" y="266" font-size="12" fill="#e5eef2" class="diagram-detail">0,00 mm</text>
<text x="353" y="173" font-size="11" fill="#b8cbd5">z = x − y</text><text id="${id}-zValue" x="353" y="190" font-size="12" fill="#e5eef2" class="diagram-detail">0,00 mm</text>
<path id="${id}-force" fill="none" stroke="#b6afd8" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
<text x="25" y="361" font-size="11" fill="#c6c0e5">ΔR op basis</text><text id="${id}-rValue" x="25" y="379" font-size="13" fill="#e5eef2" class="diagram-detail">0,0 N</text>
<path d="M408 28 V12 M403 18 L408 12 L413 18" stroke="#a9bdc7" stroke-width="1.3" fill="none"/><text x="422" y="24" font-size="11" fill="#a9bdc7">+</text>
<text x="282" y="379" font-size="9" fill="#8ea7b4">Schema · geen CAD-vervorming</text>
</svg>`;}
$('currentScene').innerHTML=sceneTemplate('cur');$('referenceScene').innerHTML=sceneTemplate('ref');
// Teken de zuiger bovenop de behuizing (zichtbaar in de cilinder).
for(const id of ['cur','ref'])$(`${id}-cylinder`).after($(`${id}-piston`));
const sceneCache={};
for(const id of ['cur','ref'])sceneCache[id]=Object.fromEntries(['mass','basis','spring','piston','cylinder','xArrow','yArrow','force','xValue','yValue','zValue','rValue'].map(k=>[k,$(`${id}-${k}`)]));
function arrow(x,y,dy,head=5){if(Math.abs(dy)<.3)return `M${x-3} ${y}H${x+3}`;head=Math.min(head,Math.abs(dy)*.45);const e=y+dy,sg=Math.sign(dy);return `M${x} ${y}L${x} ${e}M${x-head} ${e-sg*head}L${x} ${e}L${x+head} ${e-sg*head}`;}
function springPath(x,top,bottom){const a=top+12,b=bottom-12;let d=`M${x} ${top}V${a}`;for(let j=0;j<12;j++)d+=`L${x+(j%2===0?-12:12)} ${a+(b-a)*(j+.5)/12}`;return d+`L${x} ${b}V${bottom}`;}
function updateScene(id,r,s){
 const e=sceneCache[id],my=105-s.x*scale,by=280-s.y*scale;
 e.mass.setAttribute('transform',`translate(0 ${my})`);e.basis.setAttribute('transform',`translate(0 ${by})`);
 e.spring.setAttribute('d',springPath(164,my+31,by));
 e.cylinder.setAttribute('transform',`translate(235 ${by})`);
 const pistonEnd=my+112; // Zuigerstang heeft constante lengte; zuiger beweegt mee met de massa.
 e.piston.setAttribute('d',`M235 ${my+31}V${pistonEnd}M223 ${pistonEnd}H247`);
 e.xArrow.setAttribute('d',arrow(332,105,-s.x*scale));e.yArrow.setAttribute('d',arrow(332,280,-s.y*scale));
 const forceLength=-65*s.reaction/forceScale;
 e.force.setAttribute('d',arrow(70,by+7,forceLength,6));
 e.xValue.textContent=fmt(s.x*1000,2)+' mm';e.yValue.textContent=fmt(s.y*1000,2)+' mm';e.zValue.textContent=fmt(s.z*1000,2)+' mm';e.rValue.textContent=fmt(s.reaction,1)+' N';
 const tolerance=Math.max(1e-9,r.zmax*.004);
 $(id==='cur'?'currentConnection':'referenceConnection').textContent=Math.abs(s.z)<tolerance?'Verbinding vrijwel op evenwichtslengte':s.z>0?'Verbinding langer dan in statisch evenwicht':'Verbinding korter dan in statisch evenwicht';
}
function notify(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function readParams(){const p={};for(const k of Object.keys(M.defaults)){const el=$(k);p[k]=k==='profile'?el.value:(el.value.trim()===''?NaN:Number(el.value));}return M.validate(p);}
function fillParams(input){const p=M.validate(input);for(const k of Object.keys(M.defaults))$(k).value=p[k];for(const k of ['depth','speed','damping'])$(k+'Range').value=p[k];syncInputFields();}
function syncInputFields(){
 const profile=$('profile').value,periodic=profile==='periodic';
 $('repeatFields').hidden=profile!=='repeat';$('periodicFields').hidden=!periodic;
 for(const id of ['pulseCount','intervalMs'])$(id).disabled=profile!=='repeat';
 for(const id of ['frequency','cycles'])$(id).disabled=!periodic;
 for(const id of ['speed','length']){$(id).closest('.field').hidden=periodic;$(id).disabled=periodic;}
 $('speedRange').disabled=periodic;
 if(lastProfile!==profile){lastProfile=profile;refreshSweepKeys(profile);const e=$('sweepEmpty');e.querySelector('h3').textContent=profile==='repeat'?'Welke pulsafstand geeft de grootste reactie?':profile==='periodic'?'Hoe verandert de reactie met de invoerfrequentie?':'Hoe verandert de reactie met de passagesnelheid?';e.querySelector('p').textContent='Kies een parameter, een bereik en het aantal proeven. Alle andere instellingen blijven vast binnen de reeks.';}
 try{const p=readParams(),ch=M.characteristics(p);$('inputSummary').textContent=profile==='periodic'?`${ch.count} perioden · invoer ${fmt(ch.excitationEnd-ch.t0,3)} s · f/fₙ = ${fmt(p.frequency/ch.fn,2)}`:`Pulsduur ${fmt(ch.T*1000,2)} ms · ${ch.count} puls${ch.count===1?'':'en'} · geen reset tussen pulsen.`;}catch(e){$('inputSummary').textContent='Controleer de pulsduur en de start-tot-starttijd.';}
}
function refreshSweepKeys(profile){
 const key=$('sweepKey').value,keys=M.sweepKeys(profile);
 $('sweepKey').innerHTML=keys.map(k=>`<option value="${k}">${M.labels[k]} (${M.units[k]})</option>`).join('');
 $('sweepKey').value=profile==='repeat'?'intervalMs':profile==='periodic'?'frequency':'speed';setSweepRange();
}
function setSweepRange(){
 const key=$('sweepKey').value;
 const presets={mass:[2,25],stiffness:[50000,600000],damping:[0,.3],depth:[.2,2],length:[.05,.2],speed:[20,100],intervalMs:[20,100],pulseCount:[1,15],frequency:[5,60],cycles:[1,20]};
 let [a,b]=presets[key]??[0,1];
 if(key==='intervalMs'){const t=Number($('length').value)/(Number($('speed').value)/3.6)*1000;if(Number.isFinite(t)){a=Math.max(20,Math.ceil(t*1.05));b=Math.max(100,a*3);}}
 $('sweepMin').value=a;$('sweepMax').value=b;$('sweepCount').value=['pulseCount','cycles'].includes(key)?Math.min(15,b-a+1):25;
 const unit=M.units[key];$('sweepHelp').textContent=`Alleen ${M.labels[key].toLowerCase()} verandert (${unit}). Alle andere instellingen blijven vast; het observatievenster is gelijk voor elke proef.${['mass','stiffness'].includes(key)?' Bij vaste ζ wordt c = 2ζ√(km) opnieuw berekend.':''}`;
}
function setPlaying(on){running=on;prevStamp=null;holdUntil=0;syncPlay();dirty=true;}
function syncPlay(){$('playText').textContent=running?'Pauzeren':'Afspelen';$('play').querySelector('.play-icon').textContent=running?'Ⅱ':'▶';$('play').setAttribute('aria-label',running?'Animatie pauzeren':'Animatie afspelen');}
function setTime(t){time=clamp(t,0,end);dirty=true;renderFrame();}
function updateScales(){const models=[result,...reference?[reference]:[]];let peak=.0006;for(const r of models){peak=Math.max(peak,r.xmax,r.p.depth/1000,r.zmax*1.15);}scale=52/peak*Number($('zoomMotion').value);forceScale=Math.max(1,...models.map(r=>r.rmax));$('scaleText').textContent=`Beweging uitvergroot · 1 mm = ${fmt(scale/1000,1)} teken-eenheden. Krachtpijl: 65 eenheden = ${fmt(forceScale,1)} N.`;}
function scenarioDesc(p){return `${M.profiles[p.profile]} · d ${fmt(p.depth,2)} mm · ζ ${fmt(p.damping,2)} · ${p.profile==='periodic'?`${fmt(p.frequency,2)} Hz, ${p.cycles} perioden`:`v ${fmt(p.speed,1)} km/u`}${p.profile==='repeat'?` · ${p.pulseCount} pulsen / ${fmt(p.intervalMs,2)} ms`:''}`;}
function sameInput(a,b){return a.p.profile===b.p.profile&&a.T===b.T&&a.count===b.count&&a.interval===b.interval&&a.p.depth===b.p.depth;}
function allParamsText(p){return `${scenarioDesc(p)} · m ${fmt(p.mass,2)} kg · k ${fmt(p.stiffness,0)} N/m${p.profile==='periodic'?'':` · ℓ ${fmt(p.length,3)} m`}`;}

function difference(a,b,unit,digits=1){if(Math.abs(b)<1e-12)return `Referentie: ${fmt(b,digits)} ${unit}`;const pc=100*(a/b-1);return `${pc>=0?'+':''}${fmt(pc,1)}% t.o.v. referentie (${fmt(b,digits)} ${unit})`;}
function compute(p=null, autoplay=true, windowEnd=null){
 clearTimeout(debounce);
 const previousReference=reference?{...reference.p}:null;
 try{
  p=M.validate(p ?? readParams());const all=[p,...referenceParams?[referenceParams]:[]],chs=all.map(M.characteristics);
  const minimumEnd=M.sharedEnd(all),sharedEnd=windowEnd===null?minimumEnd:Math.max(windowEnd,minimumEnd);
  const next=M.solve(p,{end:sharedEnd}),nextRef=referenceParams?M.solve(referenceParams,{end:sharedEnd}):null;
  params={...p};result=next;reference=nextRef;end=sharedEnd;
  $('stageGrid').classList.toggle('compare',!!reference);$('refPanel').hidden=!reference;$('guide').hidden=!!reference;
  $('unpin').hidden=!reference;$('pin').textContent=reference?'↻ Referentie vervangen':'＋ Referentie vastzetten';
  $('currentLabel').textContent=reference?'Jouw gewijzigde scenario':'Jouw scenario';$('currentInfo').textContent=scenarioDesc(p);if(reference)$('refInfo').textContent=scenarioDesc(reference.p);
  $('timeline').max=end;$('timeline').step=Math.max(1e-6,end/100000);$('endLabel').textContent=fmt(end,3)+' s';
  $('pulseLabel').textContent=`Invoer: ${fmt(result.t0,3)}–${fmt(result.excitationEnd,3)} s`;
  $('fn').textContent=fmt(result.fn,2)+' Hz';$('zmax').textContent=fmt(result.zmax*1000,3)+' mm';$('rmax').textContent=fmt(result.rmax,1)+' N';
  $('fnDelta').textContent=reference?difference(result.fn,reference.fn,'Hz',2):'Berekend uit m en k';
  $('zDelta').textContent=reference?difference(result.zmax*1000,reference.zmax*1000,'mm',3):'Piek in dit tijdvenster';
  $('rDelta').textContent=reference?difference(result.rmax,reference.rmax,'N',1):'Geen breuk- of veiligheidsgrens';
  $('compareNote').hidden=!reference;if(reference)$('compareNote').textContent=`Referentie: ${scenarioDesc(reference.p)} · m ${fmt(reference.p.mass,1)} kg · k ${fmt(reference.p.stiffness,0)} N/m · ℓ ${fmt(reference.p.length,3)} m. De vergelijking gebruikt hetzelfde tijdvenster en dezelfde bewegings- en krachtschaal.`;
  $('status').classList.remove('error');$('status').textContent=`Berekend: ${result.t.length.toLocaleString('nl-NL')} tijdmonsters · ${result.count} ${p.profile==='periodic'?'perioden':'pulsen'}.`;
  if(checkWorker){checkWorker.terminate();checkWorker=null;}checkToken++;$('runCheck').disabled=false;$('checkStatus').textContent='Nog niet uitgevoerd voor dit scenario.';
  if(windowEnd===null&&sweep&&sweep.selected!==null){sweep.selected=null;updateSweepUI();}
  syncInputFields();updateScales();buildPlot();buildInputPlot();time=0;setPlaying(autoplay);renderFrame();return true;
 }catch(error){referenceParams=previousReference;$('status').textContent=error.message+' De animatie toont nog het laatst berekende scenario.';$('status').classList.add('error');setPlaying(false);return false;}
}
function renderFrame(){if(!result)return;const s=M.sample(result,time);updateScene('cur',result,s);if(reference)updateScene('ref',reference,M.sample(reference,time));
 $('timeline').value=time;$('timecode').textContent=`t = ${fmt(time,3)} s`;
 if(result.p.depth===0){$('phase').textContent='Geen invoer';$('insightText').textContent='De invoeramplitude is nul. Het systeem blijft in rust.';}
 else if(time<result.t0){$('phase').textContent='Voor de invoer';$('insightText').textContent='Alleen aan het begin van deze proef is het systeem in rust. Start de animatie.';}
 else if(time<=result.excitationEnd){
   const event=result.events.find(e=>time>=e.start&&time<=e.end);
   if(event){$('phase').textContent=`${result.p.profile==='periodic'?'Periode':'Puls'} ${event.index} / ${result.count}`;$('insightText').textContent=event.index===1?'De eerste invoerbeweging zet het systeem in beweging.':`De ${event.index}e invoer start vanuit de bestaande beweging. Positie en snelheid worden niet teruggezet.`;}
   else {const past=result.events.filter(e=>e.end<time).length;$('phase').textContent=`Tussen ${past} en ${past+1}`;$('insightText').textContent='De basis staat nu stil, maar de massa kan nog bewegen. Deze toestand blijft bewaard voor de volgende puls.';}
 }
 else{$('phase').textContent='Na de invoer';$('insightText').textContent=result.p.damping===0?'Alle invoer is voorbij. Zonder demping blijft het model vrij trillen; de volgende afspeelronde is géén nieuwe fysieke puls.':'Alle invoer is voorbij. De overgebleven beweging dempt uit. Opnieuw afspelen herstart alleen de weergave.';}
 updateCursor(s);updateInputCursor();dirty=false;
}

function loopFrame(stamp){if(document.hidden){prevStamp=null;requestAnimationFrame(loopFrame);return;}if(running&&result){if(prevStamp===null)prevStamp=stamp;const dt=Math.min((stamp-prevStamp)/1000,.1);prevStamp=stamp;
 if(holdUntil){if(stamp>=holdUntil){time=0;holdUntil=0;}dirty=true;}
 else{time=Math.min(end,time+dt*Number($('playSpeed').value));dirty=true;if(time>=end){if($('loop').checked)holdUntil=stamp+700;else setPlaying(false);}}
 }if(dirty)renderFrame();requestAnimationFrame(loopFrame);}
function values(r,field){return r[field];}
function pathFor(r,field,factor,X,Y){const ts=r.t,vs=values(r,field),limit=ts.findIndex(t=>t>plotMax),last=limit<0?ts.length-1:Math.max(1,limit);const stride=Math.max(1,Math.floor(last/6000));let d='';for(let i=0;i<=last;i+=stride)d+=(d?'L':'M')+X(ts[i]).toFixed(2)+' '+Y(vs[i]*factor).toFixed(2);if(last%stride!==0)d+='L'+X(ts[last]).toFixed(2)+' '+Y(vs[last]*factor).toFixed(2);return d;}
function getPlotSeries(){
 const a=[];if(mode==='motion'){a.push({r:result,field:'y',f:1000,label:'y(t) · basis',dash:'7 5',opacity:.65},{r:result,field:'x',f:1000,label:'x(t) · massa',dash:'',opacity:1});if(reference){a.push({r:reference,field:'x',f:1000,label:'x(t) · referentie',dash:'2 4',opacity:.65});if(!sameInput(reference,result))a.push({r:reference,field:'y',f:1000,label:'y(t) · referentie',dash:'10 3 2 3',opacity:.35});}}
 else if(mode==='relative'){a.push({r:result,field:'z',f:1000,label:'z(t) · jouw scenario',dash:'',opacity:1});if(reference)a.push({r:reference,field:'z',f:1000,label:'z(t) · referentie',dash:'7 5',opacity:.55});}
 else{a.push({r:result,field:'reaction',f:1,label:'ΔR(t) · totaal',dash:'',opacity:1});if(reference)a.push({r:reference,field:'reaction',f:1,label:'ΔR(t) · referentie',dash:'10 5',opacity:.55});if($('components').checked)a.push({r:result,field:'spring',f:1,label:'Veer · kz',dash:'5 4',opacity:.7},{r:result,field:'damper',f:1,label:'Demper · cż',dash:'2 3',opacity:.55});}
 return a;
}
function buildPlot(){if(!result)return;plotSeries=getPlotSeries();const W=900,H=235,L=62,R=18,top=16,bottom=37;
 plotMax=$('chartZoom').value==='pulse'?Math.min(end,Math.max(result.excitationEnd,reference?reference.excitationEnd:0)+2/Math.min(result.fn,reference?reference.fn:result.fn)):end;
 plotLo=0;plotHi=0;for(const s of plotSeries){const ts=s.r.t,vs=values(s.r,s.field);for(let i=0;i<ts.length&&ts[i]<=plotMax;i++){plotLo=Math.min(plotLo,vs[i]*s.f);plotHi=Math.max(plotHi,vs[i]*s.f);}}
 if(plotHi-plotLo<1e-12){plotLo=-1;plotHi=1;}else{const pad=(plotHi-plotLo)*.14;plotLo-=pad;plotHi+=pad;}
 const X=t=>L+t/plotMax*(W-L-R),Y=v=>top+(plotHi-v)/(plotHi-plotLo)*(H-top-bottom);
 const tick=v=>Number(v.toPrecision(3)).toLocaleString('nl-NL',{maximumFractionDigits:6});
 let content=`<defs><clipPath id="plotClip"><rect x="${L}" y="${top}" width="${W-L-R}" height="${H-top-bottom}"/></clipPath></defs>`;
 for(const e of result.events)content+=`<rect x="${X(e.start)}" y="${top}" width="${X(e.end)-X(e.start)}" height="${H-top-bottom}" fill="currentColor" opacity=".045"/>`;
 for(let i=0;i<=4;i++){const v=plotLo+(plotHi-plotLo)*i/4,py=Y(v);content+=`<line x1="${L}" x2="${W-R}" y1="${py}" y2="${py}" stroke="currentColor" opacity=".1"/><text x="${L-10}" y="${py+4}" text-anchor="end" font-size="11">${tick(v)}</text>`;}
 for(let i=0;i<=5;i++){const t=plotMax*i/5,px=X(t);content+=`<line x1="${px}" x2="${px}" y1="${top}" y2="${H-bottom}" stroke="currentColor" opacity=".055"/><text x="${px}" y="${H-bottom+22}" text-anchor="middle" font-size="11">${tick(t)}</text>`;}
 content+=`<text x="${W-R}" y="${H-2}" text-anchor="end" font-size="10">Tijd (s)</text><g clip-path="url(#plotClip)">`;
 for(const s of plotSeries)content+=`<path d="${pathFor(s.r,s.field,s.f,X,Y)}" fill="none" stroke="currentColor" stroke-width="${s.dash?1.5:2}" opacity="${s.opacity}" stroke-dasharray="${s.dash}"/>`;
 content+='</g><g id="plotCursor">';content+=`<line id="cursorLine" x1="${L}" x2="${L}" y1="${top}" y2="${H-bottom}" stroke="currentColor" stroke-width="1" opacity=".45"/>`;
 plotSeries.forEach((s,i)=>content+=`<circle id="dot${i}" cx="${L}" cy="${Y(0)}" r="3" stroke="currentColor" fill="white" stroke-width="1.5"/>`);content+='</g>';
 $('plot').innerHTML=content;$('legend').innerHTML=plotSeries.map(s=>`<span><i class="${s.dash?(s.dash==='2 4'?'dots':'dash'):''}"></i>${s.label}</span>`).join('');
 $('plotUnit').textContent=mode==='force'?'Reactiekracht · N':'Verplaatsing · mm';$('componentsWrap').hidden=mode!=='force';
 $('plot').setAttribute('aria-label',mode==='force'?'Berekende reactiekracht en gesynchroniseerde tijdcursor':'Berekende verplaatsing en gesynchroniseerde tijdcursor');dirty=true;
}
function updateCursor(sample){if(!$('plotCursor'))return;const cursor=$('plotCursor');if(time>plotMax){cursor.style.display='none';return;}cursor.style.display='';const X=t=>62+t/plotMax*(900-62-18),Y=v=>16+(plotHi-v)/(plotHi-plotLo)*(235-16-37);
 const xx=X(time);$('cursorLine').setAttribute('x1',xx);$('cursorLine').setAttribute('x2',xx);
 for(let i=0;i<plotSeries.length;i++){const s=plotSeries[i],sv=s.r===result?sample:M.sample(reference,time),v=sv[s.field]*s.f;$('dot'+i).setAttribute('cx',xx);$('dot'+i).setAttribute('cy',Y(v));}
}
function onChange(){syncInputFields();setPlaying(false);$('status').classList.remove('error');$('status').textContent='Parameter gewijzigd. Berekening bijwerken…';clearTimeout(debounce);if($('auto').checked)debounce=setTimeout(()=>compute(null,true),160);else $('status').textContent='Klik op Simulatie starten om de nieuwe waarden te berekenen.';}
for(const key of Object.keys(M.defaults))$(key).addEventListener('input',()=>{if($(key+'Range'))$(key+'Range').value=$(key).value;onChange();});
for(const key of ['depth','speed','damping'])$(key+'Range').addEventListener('input',()=>{$(key).value=$(key+'Range').value;onChange();});
$('controls').addEventListener('submit',e=>{e.preventDefault();if($('controls').reportValidity())compute(null,true);});
$('auto').addEventListener('change',()=>{if($('auto').checked)compute(null,true);});
$('play').addEventListener('click',()=>{if(!running&&time>=end)time=0;setPlaying(!running);});
$('gotoParams').addEventListener('click',()=>$('parameters').scrollIntoView({behavior:'smooth',block:'start'}));
$('backToStage').addEventListener('click',()=>$('stage').scrollIntoView({behavior:'smooth',block:'start'}));
$('restart').addEventListener('click',()=>{setTime(0);holdUntil=0;prevStamp=null;});
$('peak').addEventListener('click',()=>{setPlaying(false);setTime(result.peakTime);});
$('timeline').addEventListener('input',()=>{setPlaying(false);setTime(Number($('timeline').value));});
$('playSpeed').addEventListener('change',()=>{prevStamp=null;});
$('zoomMotion').addEventListener('change',()=>{updateScales();dirty=true;renderFrame();});
$('chartZoom').addEventListener('change',()=>{buildPlot();renderFrame();});
$('components').addEventListener('change',()=>{buildPlot();renderFrame();});
for(const tab of document.querySelectorAll('[data-mode]'))tab.addEventListener('click',()=>{mode=tab.dataset.mode;for(const t of document.querySelectorAll('[data-mode]'))t.setAttribute('aria-selected',String(t===tab));buildPlot();renderFrame();});
$('pin').addEventListener('click',()=>{referenceParams={...result.p};compute(result.p,false);notify('Referentie vastgezet. Verander nu één parameter.');});
$('unpin').addEventListener('click',()=>{referenceParams=null;compute(result.p,false);});
$('reset').addEventListener('click',()=>{referenceParams=null;fillParams(M.defaults);compute(M.defaults,true);notify('Startwaarden hersteld; vergelijking gewist.');});
function experiment(change){try{const p=readParams();const next=change({...p});M.validate(next);if(!referenceParams)referenceParams={...result.p};fillParams(next);compute(next,true);}catch(err){notify(err.message);}}
$('experimentDouble').addEventListener('click',()=>experiment(p=>({...p,depth:p.depth*2})));
$('experimentUndamped').addEventListener('click',()=>experiment(p=>({...p,damping:0})));
$('experimentRepeat').addEventListener('click',()=>{try{const p=readParams();referenceParams={...p,profile:'single'};const next={...p,profile:'repeat',pulseCount:5,intervalMs:Math.max(45,p.length/(p.speed/3.6)*1100)};fillParams(next);compute(next,true);notify('Vijf pulsen vergeleken met één puls, met dezelfde pulsbreedte en amplitude.');}catch(e){notify(e.message);}});
$('experimentPeriodic').addEventListener('click',()=>{const p={...result.p,profile:'periodic'};referenceParams=null;fillParams(p);compute(p,true);notify('Periodieke invoer gekozen. Onderzoek nu de invoerfrequentie.');});
let dragging=false;function chartSeek(e){const rect=$('plot').getBoundingClientRect(),px=(e.clientX-rect.left)/rect.width*900;setPlaying(false);setTime((px-62)/(900-62-18)*plotMax);}
$('plot').addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;$('plot').setPointerCapture(e.pointerId);chartSeek(e);});
$('plot').addEventListener('pointermove',e=>{if(dragging)chartSeek(e);});
$('plot').addEventListener('pointerup',()=>{dragging=false;});$('plot').addEventListener('pointercancel',()=>{dragging=false;});
function scenarioFile(){return {format:'gvb-visueel-scenario',version:3,status:'SYNTHETISCH; geen fysieke validatie',parameters:{...result.p},reference:referenceParams?{...referenceParams}:null,observationEnd:result.end,units:{...M.units}};}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
$('saveScenario').addEventListener('click',()=>download('gvb_scenario_v3.json',JSON.stringify(scenarioFile(),null,2),'application/json'));
$('loadScenario').addEventListener('click',()=>$('importFile').click());
function load(data){if(!data||data.format!=='gvb-visueel-scenario'||![2,3].includes(data.version))throw new Error('Kies een scenariobestand van simulator v2 of v3.');const p=M.validate(data.parameters),ref=data.reference?M.validate(data.reference):null;referenceParams=ref;fillParams(p);if(!compute(p,false,data.version===3?validatedEnd(data.observationEnd):null))throw new Error('Dit scenario kan niet worden berekend.');notify('Scenario geladen. Klik op Afspelen.');}
$('importFile').addEventListener('change',async()=>{const f=$('importFile').files[0];if(!f)return;try{if(f.size>20000)throw new Error('Scenariobestand te groot.');load(JSON.parse(await f.text()));}catch(e){notify(e.message);}finally{$('importFile').value='';}});
$('csv').addEventListener('click',()=>{const r=result,rows=['tijd_s,x_m,y_m,z_m,x_snelheid_m_s,y_snelheid_m_s,veer_N,demper_N,dynamische_reactie_N'];for(let i=0;i<r.t.length;i++)rows.push([r.t[i],r.x[i],r.y[i],r.z[i],r.velocity[i],r.yVelocity[i],r.spring[i],r.damper[i],r.reaction[i]].join(','));download('gvb_resultaten_synthetisch.csv',rows.join('\n'),'text/csv;charset=utf-8');notify('CSV bevat jouw berekende scenario; SI-eenheden, punt als decimaalteken.');});
$('share').addEventListener('click',async()=>{if(!/^https?:$/.test(location.protocol)){download('gvb_scenario_v3.json',JSON.stringify(scenarioFile(),null,2),'application/json');notify('Lokaal bestand: deel het scenario-JSON samen met deze HTML. Een web-link werkt na hosting.');return;}const link=location.origin+location.pathname+'#scenario='+encodeURIComponent(JSON.stringify(scenarioFile()));try{await navigator.clipboard.writeText(link);notify('Scenariolink gekopieerd. De waarden staan alleen in de URL.');}catch(e){window.prompt('Kopieer deze scenariolink:',link);}});
document.addEventListener('visibilitychange',()=>{prevStamp=null;});
function validatedEnd(value){if(value==null)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>120)throw new Error('Ongeldig opgeslagen tijdvenster.');return value;}
function buildInputPlot(){
 if(!result)return;const W=900,H=84,L=20,R=20,top=10,bottom=20,depth=Math.max(.0001,result.p.depth/1000);
 const X=t=>L+t/end*(W-L-R),Y=y=>top-y/depth*36;
 let content=`<line x1="${L}" y1="${top}" x2="${W-R}" y2="${top}" stroke="currentColor" opacity=".15"/>`,path='';
 // Bemonster elk event afzonderlijk: ook zeer smalle pulsen blijven zichtbaar.
 const times=[0];for(const e of result.events){for(let j=0;j<=50;j++)times.push(e.start+(e.end-e.start)*j/50);}times.push(end);
 for(let i=0;i<times.length;i++){const t=times[i];path+=`${i?'L':'M'}${X(t).toFixed(2)} ${Y(M.base(t,result.p,result)[0]).toFixed(2)} `;}
 content+=`<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
 for(const e of result.events)if(result.count<=12)content+=`<text x="${X((e.start+e.end)/2)}" y="${H-13}" text-anchor="middle">${e.index}</text>`;
 content+=`<line id="inputCursor" x1="${L}" x2="${L}" y1="4" y2="${H-7}" stroke="currentColor" stroke-dasharray="2 3" opacity=".5"/><text x="${W-R}" y="${H-1}" text-anchor="end">${fmt(end,3)} s</text>`;
 $('inputPlot').innerHTML=content;$('profileCaption').textContent=`${M.profiles[result.p.profile]} · ${result.count} ${result.p.profile==='periodic'?'perioden':'pulsen'}`;
}
function updateInputCursor(){if($('inputCursor')){const x=20+time/end*860;$('inputCursor').setAttribute('x1',x);$('inputCursor').setAttribute('x2',x);}}
function newWorker(){const url=URL.createObjectURL(new Blob([$('workerCode').textContent],{type:'text/javascript'}));try{const w=new Worker(url);setTimeout(()=>URL.revokeObjectURL(url),1000);return w;}catch(e){URL.revokeObjectURL(url);throw e;}}
function cancelSweep(){sweepToken++;if(sweepWorker){sweepWorker.terminate();sweepWorker=null;}sweepBusy=false;$('sweepStart').disabled=false;$('sweepCancel').hidden=true;if(sweep){sweep.state='cancelled';$('sweepStatus').textContent=`Gestopt. ${sweep.rows.length} berekende proeven blijven beschikbaar.`;}}
function updateSweepUI(){
 if(!sweep)return;const {plan,rows}=sweep;
 $('sweepEmpty').hidden=rows.length>0;$('sweepResults').hidden=!rows.length;
 $('sweepSnapshot').textContent=`${allParamsText(plan.baseline)}. Gevarieerd: ${plan.label} (${plan.units}). Vast venster 0–${fmt(plan.end,4)} s.`;
 $('sweepProgress').value=rows.length;$('sweepProgress').max=plan.count;
 $('sweepColName').textContent=`${plan.label} (${plan.units})`;
 $('sweepRows').innerHTML=rows.map((r,i)=>`<tr${i===sweep.selected?' class="selected"':''}><td>${i+1}</td><td>${fmt(r.value,3)}</td><td>${fmt(r.rmax,2)}</td><td>${fmt(r.zmax*1000,4)}</td><td><button data-trial="${i}" aria-label="Proef ${i+1} afspelen">Afspelen</button></td></tr>`).join('');
 $('sweepRows').querySelectorAll('[data-trial]').forEach(b=>b.addEventListener('click',()=>selectTrial(Number(b.dataset.trial))));
 buildSweepPlot();
}
function sweepMetric(){return $('sweepMetric').value==='zmax'?{key:'zmax',factor:1000,unit:'mm',label:'Maximum |z|'}:{key:'rmax',factor:1,unit:'N',label:'Maximum |ΔR|'};}
function buildSweepPlot(){
 if(!sweep||!sweep.rows.length)return;const {plan,rows,selected}=sweep,met=sweepMetric(),W=900,H=290,L=68,R=22,top=20,bottom=55;
 const peak=Math.max(...rows.map(r=>r[met.key]*met.factor)),hi=Math.max(1e-6,peak*1.15),X=v=>L+(v-plan.min)/(plan.max-plan.min)*(W-L-R),Y=v=>top+(hi-v)/hi*(H-top-bottom);
 let out='';for(let i=0;i<=4;i++){const v=hi*i/4,y=Y(v);out+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".10"/><text x="${L-10}" y="${y+4}" font-size="11" text-anchor="end">${fmt(v,v<.1?3:1)}</text>`;}
 for(let i=0;i<=5;i++){const v=plan.min+(plan.max-plan.min)*i/5;out+=`<text x="${X(v)}" y="${H-bottom+22}" font-size="11" text-anchor="middle">${fmt(v,v<1?2:1)}</text>`;}
 out+=`<text x="${L}" y="11" font-size="10">${met.label} (${met.unit})</text><text x="${W-R}" y="${H-7}" font-size="11" text-anchor="end">${plan.label} (${plan.units})</text>`;
 // Een lijn is een visuele gids tussen proeven, geen extra berekende data.
 out+=`<path d="${rows.map((r,i)=>`${i?'L':'M'}${X(r.value)} ${Y(r[met.key]*met.factor)}`).join(' ')}" stroke="currentColor" fill="none" opacity=".5" stroke-width="1.5"/>`;
 rows.forEach((r,i)=>{const x=X(r.value),y=Y(r[met.key]*met.factor);out+=`<g class="trial-point" data-index="${i}" role="button" tabindex="0" aria-label="Proef ${i+1}: ${plan.label} ${fmt(r.value,3)} ${plan.units}, ${met.label} ${fmt(r[met.key]*met.factor,3)} ${met.unit}. Afspelen."><circle cx="${x}" cy="${y}" r="12" fill="transparent"/><circle class="point-outline" cx="${x}" cy="${y}" r="${i===selected?6:4}" fill="${i===selected?'#135f60':'white'}" stroke="currentColor" stroke-width="1.7"/><title>Proef ${i+1} · ${fmt(r.value,3)} ${plan.units} → ${fmt(r[met.key]*met.factor,3)} ${met.unit}</title></g>`;});
 $('sweepPlot').innerHTML=out;
 $('sweepPlot').querySelectorAll('[data-index]').forEach(el=>{const fn=()=>selectTrial(Number(el.dataset.index));el.addEventListener('click',fn);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}});});
 let maxrow=rows.reduce((a,b)=>a[met.key]>=b[met.key]?a:b);
 $('sweepInsight').textContent=peak<1e-10?'Alle berekende reacties zijn nul. Controleer of je een niet-nulle invoeramplitude hebt gekozen.':`Grootste getoonde piek: ${fmt(maxrow[met.key]*met.factor,3)} ${met.unit}, bij ${plan.label.toLowerCase()} = ${fmt(maxrow.value,3)} ${plan.units}. Dit geldt voor ${rows.length} berekende proeven, niet voor alle mogelijke waarden.`;
 $('selectedTrial').hidden=selected==null;
 if(selected!=null){const r=rows[selected];$('selectedTrial').textContent=`Gekozen: proef ${selected+1} · ${fmt(r.value,3)} ${plan.units}. De animatie hierboven vergelijkt deze proef met de vaste basis van deze reeks.`;}
}
function selectTrial(index,scroll=true){
 if(!sweep||!Number.isInteger(index)||!sweep.rows[index])return false;
 const r=sweep.rows[index];referenceParams={...sweep.plan.baseline};fillParams(r.parameters);
 if(!compute(r.parameters,true,sweep.plan.end))return false;
 sweep.selected=index;updateSweepUI();
 if(scroll)$('stage').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 notify(`Proef ${index+1} geladen. De referentie is de vaste basis van het onderzoek.`);return true;
}
async function startSweep(){
 let p,plan;try{p=readParams();plan=M.makeSweep(p,$('sweepKey').value,Number($('sweepMin').value),Number($('sweepMax').value),Number($('sweepCount').value));}catch(e){$('sweepStatus').textContent=e.message;$('sweepStatus').classList.add('error');return false;}
 if(sweepWorker)sweepWorker.terminate();const token=++sweepToken;sweepBusy=true;sweep={plan,rows:[],selected:null,state:'running'};
 $('sweepStart').disabled=true;$('sweepCancel').hidden=false;$('sweepProgress').hidden=false;$('sweepProgress').value=0;$('sweepProgress').max=plan.count;
 $('sweepStatus').classList.remove('error');$('sweepStatus').textContent=`0 / ${plan.count} proeven · één doorlopende berekening per proef.`;$('sweepResults').hidden=true;$('sweepEmpty').hidden=false;
 const receive=data=>{
  if(token!==sweepToken)return;
  if(data.kind==='row'){sweep.rows.push(data.row);$('sweepStatus').textContent=`${data.completed} / ${data.total} proeven berekend`;updateSweepUI();}
  if(data.kind==='done'||data.kind==='error'){
   sweepBusy=false;$('sweepStart').disabled=false;$('sweepCancel').hidden=true;
   if(sweepWorker){sweepWorker.terminate();sweepWorker=null;}
   sweep.state=data.kind==='done'?'complete':'error';
   $('sweepStatus').textContent=data.kind==='done'?`${plan.count} proeven klaar. Klik op een punt om de bijbehorende beweging te zien.`:data.message;
   $('sweepStatus').classList.toggle('error',data.kind==='error');updateSweepUI();
  }
 };
 const fallback=async()=>{
  if(token!==sweepToken)return;
  sweep.rows=[];sweep.state='running';
  $('sweepStatus').textContent='Rekenen per proef zonder worker; stoppen is mogelijk tussen proeven.';
  for(let i=0;i<plan.count;i++){
   await new Promise(resolve=>setTimeout(resolve,16));if(token!==sweepToken)return;
   try{const r=M.solve(plan.scenarios[i],{end:plan.end,summaryOnly:true});receive({kind:'row',row:{...M.summary(r),index:i,value:plan.values[i]},completed:i+1,total:plan.count});}catch(e){receive({kind:'error',message:e.message});return;}
  }receive({kind:'done'});
 };
 try{sweepWorker=newWorker();sweepWorker.onmessage=e=>receive(e.data);sweepWorker.onerror=e=>{e.preventDefault();if(sweepWorker){sweepWorker.terminate();sweepWorker=null;}fallback();};sweepWorker.postMessage({kind:'sweep',parameters:p,key:plan.key,min:plan.min,max:plan.max,count:plan.count});}catch(e){fallback();}
 return true;
}
$('sweepForm').addEventListener('submit',e=>{e.preventDefault();if($('sweepForm').reportValidity())startSweep();});
$('sweepKey').addEventListener('change',setSweepRange);$('sweepMetric').addEventListener('change',()=>buildSweepPlot());$('sweepCancel').addEventListener('click',cancelSweep);
$('sweepCSV').addEventListener('click',()=>{if(!sweep)return;const fields=Object.keys(M.defaults),rows=[['proef',...fields,'max_reactie_N','max_relatief_m','piek_tijd_s','eind_tijd_s','tijdmonsters'].join(',')];for(const r of sweep.rows)rows.push([r.index+1,...fields.map(k=>r.parameters[k]),r.rmax,r.zmax,r.peakTime,r.end,r.samples].join(','));download('gvb_parameteronderzoek_v3.csv',rows.join('\n'),'text/csv;charset=utf-8');});
$('sweepJSON').addEventListener('click',()=>{if(sweep)download('gvb_parameteronderzoek_v3.json',JSON.stringify({format:'gvb-parameteronderzoek',version:3,status:'Synthetisch; geen fysieke validatie',units:M.units,plan:sweep.plan,state:sweep.state,rows:sweep.rows},null,2),'application/json');});
$('runCheck').addEventListener('click',()=>{
 const p={...result.p},token=++checkToken;$('runCheck').disabled=true;$('checkStatus').textContent='Nul-invoer, lineariteit en tijdstapverfijning worden gecontroleerd…';
 const finish=data=>{if(token!==checkToken)return;$('runCheck').disabled=false;if(checkWorker){checkWorker.terminate();checkWorker=null;}if(data.kind==='error'){$('checkStatus').textContent='Controle niet voltooid: '+data.message;return;}const r=data.result;$('checkStatus').textContent=`${r.passed?'Rekencontroles geslaagd':'Controle vraagt aandacht'} · piekkracht verandert ${fmt(100*r.errors.force,4)}% bij een fijnere tijdstap; max. |z| verandert ${fmt(100*r.errors.motion,4)}%. Nul-invoer ${r.errors.zero<1e-10?'geslaagd':'afwijkend'}; lineariteit ${r.errors.linearity<1e-8?'geslaagd':'afwijkend'}. Geen fysieke validatie.`;};
 const fallback=()=>setTimeout(()=>{try{finish({result:M.numericalCheck(p)});}catch(e){finish({kind:'error',message:e.message});}},16);
 try{checkWorker=newWorker();checkWorker.onmessage=e=>finish(e.data);checkWorker.onerror=e=>{e.preventDefault();fallback();};checkWorker.postMessage({kind:'check',parameters:p});}catch(e){fallback();}
});
window.GVBApp={startSweep,cancelSweep,selectTrial,getSweep:()=>sweep,getState:()=>({time,running,params:{...params},referenceParams:referenceParams?{...referenceParams}:null,end,scale,forceScale,mode,result,reference}),seek:t=>{setPlaying(false);setTime(t);},setParameters:p=>{fillParams(p);return compute(p,false);},setReference:p=>{referenceParams=p?M.validate(p):null;return compute(result.p,false);},play:()=>setPlaying(true),pause:()=>setPlaying(false),load,exportScenario:scenarioFile};
window.solveModel=M.solve;
fillParams(params);compute(params,false);
if(location.hash.startsWith('#scenario=')){try{if(location.hash.length>20000)throw new Error('Scenariolink te lang.');load(JSON.parse(decodeURIComponent(location.hash.slice(10))));}catch(e){notify('Scenariolink niet geladen: '+e.message);}}
else if(!matchMedia('(prefers-reduced-motion: reduce)').matches)setPlaying(true);
requestAnimationFrame(loopFrame);
})();

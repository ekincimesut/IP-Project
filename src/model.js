/* Rekenmodel v3. Eenheden van de interface staan in units; intern uitsluitend SI.
 * Alle standaardwaarden zijn synthetische scenario's, geen GVB-metingen.
 * De toestand x, x' wordt NOOIT opnieuw ingesteld tussen invoerpulsen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GVBModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const defaults = Object.freeze({mass:10,stiffness:200000,damping:.05,depth:1,length:.15,speed:36,
    profile:'repeat',pulseCount:5,intervalMs:45,frequency:22,cycles:12});
  const bounds = Object.freeze({mass:[.1,1000],stiffness:[100,1e7],damping:[0,1],depth:[0,20],
    length:[.01,5],speed:[1,160],pulseCount:[1,40],intervalMs:[1,5000],frequency:[.2,300],cycles:[1,80]});
  const labels = Object.freeze({mass:'Effectieve massa',stiffness:'Stijfheid',damping:'Dempingsverhouding',depth:'Invoeramplitude',
    length:'Profiellengte',speed:'Passagesnelheid',pulseCount:'Aantal pulsen',intervalMs:'Start-tot-starttijd',frequency:'Invoerfrequentie',cycles:'Aantal perioden'});
  const units = Object.freeze({mass:'kg',stiffness:'N/m',damping:'–',depth:'mm',length:'m',speed:'km/u',
    pulseCount:'pulsen',intervalMs:'ms',frequency:'Hz',cycles:'perioden'});
  const profiles = Object.freeze({single:'Enkele puls',repeat:'Herhaalde pulsen',periodic:'Periodieke invoer'});
  function validate(input) {
    if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Geen geldig scenario.');
    // Oudere scenariobestanden hebben zes velden en altijd één puls.
    const p={...defaults,...input}; if (!('profile' in input)) p.profile='single';
    if (!Object.hasOwn(profiles,p.profile)) throw new Error('Onbekend invoerprofiel.');
    const q={profile:p.profile};
    for (const [key,[lo,hi]] of Object.entries(bounds)) {
      const v=p[key];
      if (typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi) throw new Error(`${labels[key]}: kies een getal tussen ${lo} en ${hi}.`);
      if (['pulseCount','cycles'].includes(key)&&!Number.isInteger(v)) throw new Error(`${labels[key]} moet een geheel getal zijn.`);
      q[key]=v;
    }
    const T=q.length/(q.speed/3.6);
    if(q.profile==='repeat'&&q.pulseCount>1&&q.intervalMs/1000<T-1e-12)
      throw new Error(`Pulsen mogen niet overlappen: kies een start-tot-starttijd van minimaal ${(1000*T).toFixed(2)} ms, of verkort de puls.`);
    return q;
  }
  function characteristics(p) {
    const wn=Math.sqrt(p.stiffness/p.mass),fn=wn/(2*Math.PI),c=2*p.damping*Math.sqrt(p.stiffness*p.mass),t0=.05;
    const T=p.profile==='periodic'?1/p.frequency:p.length/(p.speed/3.6);
    const count=p.profile==='single'?1:p.profile==='repeat'?p.pulseCount:p.cycles;
    const interval=p.profile==='repeat'?p.intervalMs/1000:T;
    const excitationEnd=t0+(count-1)*interval+T;
    const events=Array.from({length:count},(_,i)=>({start:t0+i*interval,end:t0+i*interval+T,index:i+1}));
    return {wn,fn,c,t0,T,count,interval,excitationEnd,events};
  }
  function base(t,p,ch=characteristics(p)) {
    const tau=t-ch.t0;
    if(tau<=0||t>=ch.excitationEnd) return [0,0];
    const j=Math.min(ch.count-1,Math.floor(tau/ch.interval));
    const local=tau-j*ch.interval;
    if(local<=0||local>=ch.T) return [0,0];
    const angle=2*Math.PI*local/ch.T,d=p.depth/1000;
    return [-d*(1-Math.cos(angle))/2,-d*Math.PI/ch.T*Math.sin(angle)];
  }
  function sharedEnd(params) {
    const ch=params.map(p=>characteristics(validate(p)));
    const end=Math.max(...ch.map(a=>a.excitationEnd))+Math.max(.45,...ch.map(a=>8/a.fn));
    if(!Number.isFinite(end)||end>120)throw new Error('Dit scenario duurt meer dan 120 s. Kies minder pulsen/perioden of een kortere start-tot-starttijd.');
    return end;
  }
  function plan(p,end,resolution=1) {
    const ch=characteristics(p);
    if(!Number.isFinite(end)||end<ch.excitationEnd+.001||end>120)throw new Error('Ongeldig tijdvenster. Er moet ook na de laatste invoer worden gerekend.');
    if(!Number.isFinite(resolution)||resolution<1||resolution>8)throw new Error('Ongeldige tijdresolutie.');
    const raw=[0,ch.t0,...ch.events.flatMap(e=>[e.start,e.end]),end].sort((a,b)=>a-b);
    const breaks=raw.filter((t,i)=>i===0||t-raw[i-1]>1e-11);
    const intervals=[];
    let total=1;
    for(let i=1;i<breaks.length;i++) {
      const a=breaks[i-1],b=breaks[i],mid=(a+b)/2;
      const active=ch.events.some(e=>mid>e.start&&mid<e.end);
      const rate=Math.max(ch.fn*200,active?400/ch.T:0)*resolution;
      const n=Math.max(20,Math.ceil((b-a)*rate));
      intervals.push({a,b,n});total+=n;
    }
    if(total>300000)throw new Error('Meer dan 300.000 tijdstappen nodig. Kies minder perioden/pulsen, een korter tijdvenster of een kleinere verhouding k/m.');
    return {ch,intervals,total};
  }
  function solve(input=defaults,options={}) {
    const p=validate(input),end=options.end??sharedEnd([p]),resolution=options.resolution??1;
    const {ch,intervals,total}=plan(p,end,resolution),keep=options.summaryOnly!==true;
    const r={p,...ch,end,samples:total,t:[],x:[],velocity:[],y:[],yVelocity:[],z:[],reaction:[],spring:[],damper:[],acceleration:[],
      rmax:0,zmax:0,xmax:0,peakTime:0,peakIndex:0};
    let x=0,u=0,index=0;
    function acc(t,xx,uu){const[y,yd]=base(t,p,ch);return -(p.stiffness*(xx-y)+ch.c*(uu-yd))/p.mass;}
    function record(t) {
      const[y,yd]=base(t,p,ch),z=x-y,fs=p.stiffness*z,fd=ch.c*(u-yd),R=fs+fd;
      if(!Number.isFinite(x)||!Number.isFinite(R))throw new Error('Niet-eindige uitkomst. Controleer de invoer en tijdresolutie.');
      if(Math.abs(R)>r.rmax){r.rmax=Math.abs(R);r.peakTime=t;r.peakIndex=index;}
      r.zmax=Math.max(r.zmax,Math.abs(z));r.xmax=Math.max(r.xmax,Math.abs(x));
      if(keep){r.t.push(t);r.x.push(x);r.velocity.push(u);r.y.push(y);r.yVelocity.push(yd);r.z.push(z);r.reaction.push(R);r.spring.push(fs);r.damper.push(fd);r.acceleration.push(-R/p.mass);}
      index++;
    }
    record(0);
    for(const {a,b,n} of intervals) {
      const h=(b-a)/n;
      for(let j=0;j<n;j++) {
        const t=a+j*h;
        // Het interval vóór de eerste invoer is exact in rust. Alle latere toestanden worden doorgerekend.
        if(b>ch.t0+1e-12) {
          const a1=u,b1=acc(t,x,u),a2=u+h*b1/2,b2=acc(t+h/2,x+h*a1/2,u+h*b1/2);
          const a3=u+h*b2/2,b3=acc(t+h/2,x+h*a2/2,u+h*b2/2),a4=u+h*b3,b4=acc(t+h,x+h*a3,u+h*b3);
          x+=h*(a1+2*a2+2*a3+a4)/6;u+=h*(b1+2*b2+2*b3+b4)/6;
        }
        record(a+(j+1)*h);
      }
    }
    return r;
  }
  function sample(r,time) {
    if(!r.t.length)throw new Error('Geen tijdreeks beschikbaar. Bereken dit scenario opnieuw.');
    const t=Math.max(0,Math.min(r.end,time)),a=r.t;
    let lo=0,hi=a.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(a[mid]<=t)lo=mid;else hi=mid;}
    const h=a[hi]-a[lo],s=(t-a[lo])/h,s2=s*s,s3=s2*s;
    const x=(2*s3-3*s2+1)*r.x[lo]+(s3-2*s2+s)*h*r.velocity[lo]+(-2*s3+3*s2)*r.x[hi]+(s3-s2)*h*r.velocity[hi];
    const u=(6*s2-6*s)/h*r.x[lo]+(3*s2-4*s+1)*r.velocity[lo]+(-6*s2+6*s)/h*r.x[hi]+(3*s2-2*s)*r.velocity[hi];
    const[y,yd]=base(t,r.p,r),z=x-y,spring=r.p.stiffness*z,damper=r.c*(u-yd);
    return {t,x,u,y,yd,z,spring,damper,reaction:spring+damper};
  }
  function sweepKeys(profile) {
    return ['mass','stiffness','damping','depth',...(profile==='periodic'?['frequency','cycles']:['speed','length']),...(profile==='repeat'?['intervalMs','pulseCount']:[])];
  }
  function makeSweep(input,key,min,max,count) {
    const baseline=validate(input);
    if(!sweepKeys(baseline.profile).includes(key))throw new Error('Deze parameter is niet actief bij het gekozen invoerprofiel.');
    if(![min,max,count].every(Number.isFinite)||min>=max||!Number.isInteger(count)||count<3||count>61)throw new Error('Kies minimum < maximum en 3–61 proeven.');
    const integral=['cycles','pulseCount'].includes(key);
    if(integral&&(!Number.isInteger(min)||!Number.isInteger(max)||count>max-min+1))throw new Error('Kies gehele grenzen en niet meer proeven dan verschillende gehele waarden.');
    const values=Array.from({length:count},(_,i)=>{const v=min+(max-min)*i/(count-1);return integral?Math.round(v):v;});
    const scenarios=values.map(v=>validate({...baseline,[key]:v}));
    const end=sharedEnd([baseline,...scenarios]);
    for(const p of [baseline,...scenarios])plan(p,end);
    return {key,min,max,count,values,scenarios,baseline,end,units:units[key],label:labels[key]};
  }
  function summary(r) {return {parameters:{...r.p},fn:r.fn,rmax:r.rmax,zmax:r.zmax,xmax:r.xmax,peakTime:r.peakTime,end:r.end,samples:r.samples};}
  function numericalCheck(input) {
    const p=validate(input),end=sharedEnd([p]);
    const coarse=solve(p,{end,summaryOnly:true}),fine=solve(p,{end,resolution:2,summaryOnly:true});
    const zero=solve({...p,depth:0},{end,summaryOnly:true}),half=solve({...p,depth:p.depth/2},{end,summaryOnly:true});
    const rel=(a,b)=>Math.abs(a-b)/Math.max(Math.abs(b),1e-12);
    const errors={force:rel(coarse.rmax,fine.rmax),motion:rel(coarse.zmax,fine.zmax),linearity:rel(half.rmax*2,coarse.rmax),zero:Math.max(zero.rmax,zero.zmax)};
    return {passed:errors.force<.002&&errors.motion<.002&&errors.linearity<1e-8&&errors.zero<1e-10,errors,end,
      note:'Numerieke controles, geen fysieke validatie of beoordeling van veiligheid.'};
  }
  return Object.freeze({defaults,bounds,labels,units,profiles,validate,characteristics,base,sharedEnd,plan,solve,sample,sweepKeys,makeSweep,summary,numericalCheck});
});

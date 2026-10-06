"""GVB-studentenproject, rekenmodel v3 — onafhankelijke Python/SciPy-oplossing.

Alle standaardwaarden zijn synthetisch. Geen echte isolatorkracht of breukprognose.
Parameters volgen de interface: d in mm, v in km/u, start-tot-starttijd in ms.
Intern worden uitsluitend SI-eenheden gebruikt. Zie docs/MODEL.md.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict, replace
from typing import Mapping, Any
import math
import json
import numpy as np
from scipy.integrate import solve_ivp

@dataclass(frozen=True)
class Parameters:
    """Invoer-eenheden: kg, N/m, dimensieloos, mm, m, km/u, ms en Hz."""
    mass: float = 10.0
    stiffness: float = 200_000.0
    damping: float = 0.05
    depth: float = 1.0
    length: float = 0.15
    speed: float = 36.0
    profile: str = 'repeat'
    pulseCount: int = 5
    intervalMs: float = 45.0
    frequency: float = 22.0
    cycles: int = 12

    def validate(self) -> None:
        bounds = {'mass':(.1,1000),'stiffness':(100,1e7),'damping':(0,1),'depth':(0,20),
                  'length':(.01,5),'speed':(1,160),'pulseCount':(1,40),'intervalMs':(1,5000),
                  'frequency':(.2,300),'cycles':(1,80)}
        if self.profile not in ('single','repeat','periodic'):
            raise ValueError('Onbekend invoerprofiel.')
        for name,(lo,hi) in bounds.items():
            value=getattr(self,name)
            if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not lo<=value<=hi:
                raise ValueError(f'{name}: verwacht een getal tussen {lo} en {hi}.')
        if not float(self.pulseCount).is_integer() or not float(self.cycles).is_integer():
            raise ValueError('Het aantal pulsen en perioden moet geheel zijn.')
        if self.profile=='repeat' and self.pulseCount>1 and self.intervalMs/1000 < self.length/(self.speed/3.6)-1e-12:
            raise ValueError('Pulsen overlappen. Vergroot de start-tot-starttijd of verkort de puls.')

    @classmethod
    def from_dict(cls, data: Mapping[str,Any]) -> Parameters:
        """Lees parameters uit een v2- of v3-scenariobestand."""
        values={k:v for k,v in data.items() if k in cls.__dataclass_fields__}
        if 'profile' not in values: values['profile']='single'
        p=cls(**values);p.validate();return p


def characteristics(p: Parameters) -> dict[str,Any]:
    p.validate()
    wn=math.sqrt(p.stiffness/p.mass);fn=wn/(2*math.pi)
    duration=1/p.frequency if p.profile=='periodic' else p.length/(p.speed/3.6)
    count=1 if p.profile=='single' else int(p.pulseCount if p.profile=='repeat' else p.cycles)
    interval=p.intervalMs/1000 if p.profile=='repeat' else duration
    starts=.05+np.arange(count)*interval
    return dict(wn=wn,fn=fn,c=2*p.damping*math.sqrt(p.mass*p.stiffness),T=duration,t0=.05,
                starts=starts,count=count,interval=interval,excitationEnd=float(starts[-1]+duration))


def base_motion(t: float | np.ndarray,p: Parameters) -> tuple[np.ndarray,np.ndarray]:
    """Equivalent basisprofiel en zijn analytische eerste tijdsafgeleide."""
    ch=characteristics(p);a=np.asarray(t,dtype=float)
    y=np.zeros_like(a);yd=np.zeros_like(a)
    # Onafhankelijke formulering: som over alle niet-overlappende profielvensters.
    for start in ch['starts']:
        tau=a-start;mask=(tau>0)&(tau<ch['T'])
        phase=2*np.pi*tau/ch['T'];d=p.depth/1000
        y+=np.where(mask,-d/2*(1-np.cos(phase)),0)
        yd+=np.where(mask,-d*np.pi/ch['T']*np.sin(phase),0)
    return y,yd


def observation_end(parameters: list[Parameters]) -> float:
    ch=[characteristics(p) for p in parameters]
    end=max(c['excitationEnd'] for c in ch)+max(.45,*(8/c['fn'] for c in ch))
    if end>120:raise ValueError('Observatievenster langer dan 120 s.')
    return end


@dataclass
class Result:
    parameters: Parameters
    t: np.ndarray
    x: np.ndarray
    velocity: np.ndarray
    y: np.ndarray
    y_velocity: np.ndarray
    z: np.ndarray
    spring: np.ndarray
    damper: np.ndarray
    reaction: np.ndarray
    end: float
    fn: float

    def summary(self) -> dict[str,Any]:
        index=int(np.argmax(np.abs(self.reaction)))
        return {'parameters':asdict(self.parameters),'fn':self.fn,
                'rmax':float(np.max(np.abs(self.reaction))),
                'zmax':float(np.max(np.abs(self.z))),
                'xmax':float(np.max(np.abs(self.x))),
                'peakTime':float(self.t[index]),'end':self.end,'samples':len(self.t)}


def simulate(parameters: Parameters | Mapping[str,Any] | None = None, *,
             end_s: float | None = None, times: np.ndarray | None = None) -> Result:
    """Integreer elke pulsgrens apart, maar neem x en x' mee naar het volgende interval.

    DOP853 heeft adaptieve interne stappen; times bepaalt uitsluitend de uitvoermonsters.
    Een gemeenschappelijk end_s maakt verschillende proeven vergelijkbaar.
    """
    p=parameters if isinstance(parameters,Parameters) else (Parameters.from_dict(parameters) if parameters else Parameters())
    p.validate();ch=characteristics(p)
    end=observation_end([p]) if end_s is None else float(end_s)
    if not math.isfinite(end) or not ch['excitationEnd']+.001<=end<=120:
        raise ValueError('Ongeldig observatievenster.')
    raw=sorted([0.,.05,end,*map(float,ch['starts']),*map(float,ch['starts']+ch['T'])])
    edges=[raw[0]]
    for value in raw[1:]:
        if value-edges[-1]>1e-11:edges.append(value)
    if times is None:
        segments=[];total=1
        for a,b in zip(edges[:-1],edges[1:]):
            mid=(a+b)/2;active=any(s<mid<s+ch['T'] for s in ch['starts'])
            n=max(20,math.ceil((b-a)*max(ch['fn']*200,400/ch['T'] if active else 0)))
            total+=n
            if total>300_000:raise ValueError('Meer dan 300.000 uitvoermonsters nodig.')
            segments.append(np.linspace(a,b,n+1)[1:])
        t=np.concatenate(([0.],*segments))
    else:
        t=np.asarray(times,dtype=float)
        if t.ndim!=1 or len(t)<2 or len(t)>300_000 or not np.isfinite(t).all() or np.any(np.diff(t)<=0) or t[0]<0 or t[-1]>end+1e-10:
            raise ValueError('Ongeldige uitvoertijden.')
    x=np.zeros_like(t);velocity=np.zeros_like(t);state=np.array([0.,0.])
    # Efficiënte scalaire invoer met dezelfde fysica, onafhankelijk van de JS-implementatie.
    def rhs(time,state):
        yy=yyd=0.
        for start in ch['starts']:
            tau=time-start
            if 0<tau<ch['T']:
                phase=2*math.pi*tau/ch['T'];d=p.depth/1000
                yy+=-d/2*(1-math.cos(phase));yyd+=-d*math.pi/ch['T']*math.sin(phase)
        xx,u=state
        return [u,-(p.stiffness*(xx-yy)+ch['c']*(u-yyd))/p.mass]
    for a,b in zip(edges[:-1],edges[1:]):
        if b<=.05+1e-12:continue
        mid=(a+b)/2;active=any(s<mid<s+ch['T'] for s in ch['starts'])
        max_step=min(1/ch['fn']/40,ch['T']/60) if active else 1/ch['fn']/40
        sol=solve_ivp(rhs,(a,b),state,method='DOP853',rtol=1e-10,atol=[1e-13,1e-11],
                      max_step=max_step,dense_output=True)
        if not sol.success:raise RuntimeError(sol.message)
        mask=(t>a)&(t<=b+1e-13)
        x[mask],velocity[mask]=sol.sol(np.clip(t[mask],a,b))
        state=sol.y[:,-1].copy()  # Geen reset tussen pulsen of perioden.
    y,yd=base_motion(t,p);z=x-y;spring=p.stiffness*z;damper=ch['c']*(velocity-yd)
    return Result(p,t,x,velocity,y,yd,z,spring,damper,spring+damper,end,ch['fn'])


def parameter_study(p: Parameters,key: str,start: float,stop: float,count: int=25) -> list[dict[str,Any]]:
    """Eén parameter, een vaste basis en een identiek observatievenster."""
    if key not in Parameters.__dataclass_fields__ or key=='profile':raise ValueError('Onbekende numerieke parameter.')
    inactive={'speed','length','intervalMs','pulseCount'} if p.profile=='periodic' else {'frequency','cycles'}
    if p.profile=='single':inactive|={'intervalMs','pulseCount'}
    if key in inactive:raise ValueError('Deze parameter is niet actief bij dit profiel.')
    if not 3<=count<=61 or count!=int(count) or not start<stop:raise ValueError('Kies 3–61 proeven en start < stop.')
    values=np.linspace(start,stop,int(count))
    if key in ('pulseCount','cycles'):
        if not float(start).is_integer() or not float(stop).is_integer() or count>stop-start+1:raise ValueError('Ongeldige gehele parameterreeks.')
        values=np.floor(values+.5).astype(int)
    variants=[replace(p,**{key:float(v) if key not in ('pulseCount','cycles') else int(v)}) for v in values]
    for v in variants:v.validate()
    end=observation_end([p,*variants])
    return [dict(value=float(value),**simulate(v,end_s=end).summary()) for value,v in zip(values,variants)]


def plot_simulation(r: Result):
    """Afzonderlijke figuren met standaard matplotlibkleuren; geen lokale spanning."""
    import matplotlib.pyplot as plt
    figures=[]
    fig,ax=plt.subplots(figsize=(10,4));ax.plot(r.t,r.y*1000,'--',label='y(t) · basis');ax.plot(r.t,r.x*1000,label='x(t) · massa')
    ax.set(xlabel='Tijd (s)',ylabel='Verplaatsing (mm)',title='Invoer en respons — synthetisch scenario');ax.grid(alpha=.2);ax.legend();fig.tight_layout();figures.append(fig)
    fig,ax=plt.subplots(figsize=(10,4));ax.plot(r.t,r.z*1000);ax.set(xlabel='Tijd (s)',ylabel='z(t) (mm)',title='Relatieve beweging');ax.grid(alpha=.2);fig.tight_layout();figures.append(fig)
    fig,ax=plt.subplots(figsize=(10,4));ax.plot(r.t,r.reaction);ax.set(xlabel='Tijd (s)',ylabel='Dynamische reactiekracht (N)',title='Reactie op de basis — geen breukgrens');ax.grid(alpha=.2);fig.tight_layout();figures.append(fig)
    return figures


if __name__=='__main__':
    print(json.dumps(simulate().summary(),indent=2,ensure_ascii=False))

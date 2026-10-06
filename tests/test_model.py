"""Numerieke regressie- en consistentiecontroles; geen fysieke validatie."""
from pathlib import Path
import sys,json,subprocess
import numpy as np
import pytest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from gvb_simulatie import Parameters,simulate,base_motion


def node(code,payload=None):
    js="const M=require('./src/model.js');const p=JSON.parse(require('fs').readFileSync(0,'utf8')||'null');"+code
    r=subprocess.run(['node','-e',js],input=json.dumps(payload),text=True,cwd=ROOT,capture_output=True,check=True,timeout=35)
    return json.loads(r.stdout)

@pytest.mark.parametrize('profile',['single','repeat','periodic'])
def test_scipy_against_browser(profile):
    r=node('console.log(JSON.stringify(M.solve({...M.defaults,...p})))',{'profile':profile})
    ref=simulate(r['p'],end_s=r['end'],times=np.array(r['t']))
    for field in ['x','z','reaction','velocity']:
        a=np.array(r[field]);b=getattr(ref,field)
        assert np.max(abs(a-b))<max(1e-10,2e-6*np.max(abs(b))),field

@pytest.mark.parametrize('profile',['single','repeat','periodic'])
def test_zero_input(profile):
    r=node('console.log(JSON.stringify(M.summary(M.solve({...M.defaults,...p,depth:0}))))',{'profile':profile})
    assert r['rmax']==0 and r['zmax']==0

@pytest.mark.parametrize('profile',['single','repeat','periodic'])
def test_linearity(profile):
    data=node('const a=M.solve({...M.defaults,...p});const b=M.solve({...M.defaults,...p,depth:2});console.log(JSON.stringify([a.rmax,b.rmax,a.zmax,b.zmax]));',{'profile':profile})
    assert data[1]==pytest.approx(2*data[0],rel=1e-12)
    assert data[3]==pytest.approx(2*data[2],rel=1e-12)


def test_single_pulse_legacy_regression():
    r=node('console.log(JSON.stringify(M.summary(M.solve({mass:10,stiffness:200000,damping:.05,depth:1,length:.15,speed:36}))))')
    assert r['parameters']['profile']=='single'
    assert r['rmax']==pytest.approx(184.37065,rel=2e-6)


def test_one_repeated_pulse_equals_single():
    a,b=node('console.log(JSON.stringify([M.summary(M.solve({...M.defaults,profile:"repeat",pulseCount:1})),M.summary(M.solve({...M.defaults,profile:"single"}))]));')
    assert a['rmax']==pytest.approx(b['rmax'],rel=1e-12)


def test_state_carried_across_second_pulse():
    data=node('const r=M.solve(M.defaults);const t=r.events[1].start;console.log(JSON.stringify([M.sample(r,t-1e-8),M.sample(r,t),M.sample(r,t+1e-8)]));')
    before,at,after=data
    assert abs(at['x'])>1e-6 or abs(at['u'])>1e-5
    assert abs(after['x']-before['x'])<1e-7
    assert abs(after['u']-before['u'])<1e-5


def test_base_c1_at_all_boundaries():
    data=node('const q={...M.defaults};const ch=M.characteristics(q);console.log(JSON.stringify(ch.events.flatMap(e=>[e.start,e.end]).map(t=>[M.base(t-1e-9,q),M.base(t,q),M.base(t+1e-9,q)])));')
    for before,at,after in data:
        assert max(abs(before[0]),abs(at[0]),abs(after[0]))<1e-12
        assert max(abs(before[1]),abs(at[1]),abs(after[1]))<1e-6


def test_periodic_matches_adjacent_pulses():
    data=node('const a={...M.defaults,profile:"periodic",frequency:25,cycles:5};const b={...M.defaults,profile:"repeat",pulseCount:5,length:.4,speed:36,intervalMs:40};console.log(JSON.stringify([M.summary(M.solve(a)),M.summary(M.solve(b))]));')
    assert data[0]['rmax']==pytest.approx(data[1]['rmax'],rel=1e-10)


def test_newton_and_components_at_interpolated_times():
    data=node('const r=M.solve(M.defaults);console.log(JSON.stringify(Array.from({length:301},(_,i)=>M.sample(r,r.end*i/300))));')
    for s in data:
        assert s['z']==pytest.approx(s['x']-s['y'],abs=1e-14)
        assert s['reaction']==pytest.approx(s['spring']+s['damper'],abs=1e-10)


def test_no_damping_free_energy_conservation():
    data=node('const r=M.solve({...M.defaults,damping:0});const e=r.t.map((t,i)=>t>r.excitationEnd?(.5*r.p.mass*r.velocity[i]**2+.5*r.p.stiffness*r.x[i]**2):null).filter(x=>x!==null);console.log(JSON.stringify([Math.min(...e),Math.max(...e)]));')
    assert (data[1]-data[0])/data[1]<1e-5


def test_damped_energy_nonincreasing_after_input():
    data=node('const r=M.solve(M.defaults);console.log(JSON.stringify(r.t.map((t,i)=>t>r.excitationEnd?(.5*r.p.mass*r.velocity[i]**2+.5*r.p.stiffness*r.x[i]**2):null).filter(x=>x!==null)));')
    assert np.max(np.diff(data))<1e-9


def test_sweep_common_window_and_replay():
    data=node('const s=M.makeSweep(M.defaults,"intervalMs",20,100,5);console.log(JSON.stringify(s.scenarios.map(p=>{const r=M.solve(p,{end:s.end,summaryOnly:true});const a=M.solve(p,{end:s.end});return [r.end,a.end,r.rmax,a.rmax]})));')
    assert len(set(r[0] for r in data))==1
    assert all(r[0]==r[1] and r[2]==r[3] for r in data)


def test_numerical_controls():
    data=node('console.log(JSON.stringify(M.numericalCheck(M.defaults)));')
    assert data['passed'] is True

@pytest.mark.parametrize('change',[{'profile':'unknown'},{'mass':0},{'pulseCount':2.5},{'intervalMs':2},{'cycles':0},{'damping':-1}])
def test_invalid_inputs_rejected(change):
    data=node('let error=false;try{M.solve({...M.defaults,...p})}catch(e){error=true}console.log(JSON.stringify(error));',change)
    assert data is True


def test_inactive_parameter_sweep_rejected():
    data=node('let error=false;try{M.makeSweep({...M.defaults,profile:"periodic"},"speed",20,80,5)}catch(e){error=true}console.log(JSON.stringify(error));')
    assert data is True


def test_no_physical_amplitude_change_in_visual_core():
    # Rekenmodule bevat geen DOM of weergaveschaal als fysieke parameter.
    src=(ROOT/'src/model.js').read_text()
    assert 'document.' not in src
    assert 'requestAnimationFrame' not in src

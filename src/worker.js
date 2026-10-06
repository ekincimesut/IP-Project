/* Losse rekenworker, volledig lokaal. De hoofdthread blijft de animatie tekenen. */
self.onmessage = function ({data}) {
  try {
    const M=self.GVBModel;
    if(data.kind==='check') {self.postMessage({kind:'check',result:M.numericalCheck(data.parameters)});return;}
    if(data.kind!=='sweep')throw new Error('Onbekende rekentaak.');
    const p=M.makeSweep(data.parameters,data.key,data.min,data.max,data.count);
    self.postMessage({kind:'plan',plan:p});
    for(let i=0;i<p.scenarios.length;i++) {
      const r=M.solve(p.scenarios[i],{end:p.end,summaryOnly:true});
      self.postMessage({kind:'row',row:{...M.summary(r),index:i,value:p.values[i]},completed:i+1,total:p.count});
    }
    self.postMessage({kind:'done'});
  } catch(error) {self.postMessage({kind:'error',message:error.message});}
};

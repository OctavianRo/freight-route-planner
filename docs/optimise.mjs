// Every candidate is a complete assignment of the same eligible orders.
export function optimise(orders,{limit,depot,priority,maxKm,distance}){
  if(!orders.length)return [];
  const newest=orders.reduce((d,o)=>Math.max(d,o.day),-Infinity);
  function route(stops){
    let kg=0,km=0,previous=depot,oldest=Infinity,urgency=0;
    for(const order of stops){
      kg+=order.kg; km+=distance(previous,order.pt); previous=order.pt;
      oldest=Math.min(oldest,order.day); urgency+=newest-order.day;
    }
    return {stops,kg,km:km+distance(previous,depot),oldest,urgency};
  }
  function insert(load,order){
    if(load.kg+order.kg>limit)return null;
    let bestKm=Infinity,slot=-1;
    for(let i=0;i<=load.stops.length;i++){
      const a=load.stops[i-1]?.pt ?? depot,b=load.stops[i]?.pt ?? depot;
      const km=load.km-distance(a,b)+distance(a,order.pt)+distance(order.pt,b);
      if(km<bestKm && km<=maxKm){slot=i;bestKm=km;}
    }
    if(slot<0)return null;
    const stops=load.stops.slice();stops.splice(slot,0,order);
    const result=route(stops);
    return result.km<=maxKm ? result : null;
  }
  function rank(loads){
    const sorted=loads.slice().sort((a,b)=>a.oldest-b.oldest || b.urgency-a.urgency);
    const cost=sorted.reduce((sum,l,i)=>sum+l.km+priority*i*l.urgency,0);
    return {loads:sorted,cost};
  }
  function better(a,b){
    return a.loads.length<b.loads.length || (a.loads.length===b.loads.length && a.cost<b.cost-1e-8);
  }
  const oldestFirst=orders.slice().sort((a,b)=>a.day-b.day);
  const heavyFirst=orders.slice().sort((a,b)=>b.kg-a.kg || a.day-b.day);
  const farFirst=orders.slice().sort((a,b)=>distance(depot,b.pt)-distance(depot,a.pt) || a.day-b.day);
  function build(sequence,compact){
    const loads=[];
    for(const order of sequence){
      let best,at=-1,score=Infinity;
      for(const [i,load] of loads.entries()){
        const candidate=insert(load,order);
        if(!candidate)continue;
        const added=candidate.km-load.km;
        const value=compact ? (limit-candidate.kg)/limit*maxKm+added : added;
        if(value<score){best=candidate;score=value;at=i;}
      }
      if(best)loads[at]=best;
      else loads.push(route([order]));
    }
    return rank(loads);
  }
  let result=build(oldestFirst,false);
  for(const [sequence,compact] of [[heavyFirst,true],[heavyFirst,false],[farFirst,false],[oldestFirst,true]]){
    const alternative=build(sequence,compact);
    if(better(alternative,result))result=alternative;
  }
  // Relocate individual orders within or between trips. A move can empty a
  // trip. Evaluate directed legs again because road distances are asymmetric.
  let trials=0;
  for(let pass=0;pass<6 && trials<10000;pass++){
    let improved=result;
    for(const [i,from] of result.loads.entries()){
      for(const [k,order] of from.stops.entries()){
        const rest=route(from.stops.filter((_,index)=>index!==k));
        if(rest.km>maxKm)continue;
        for(const [j,to] of result.loads.entries()){
          if(++trials>10000)break;
          const target=insert(i===j?rest:to,order);
          if(!target)continue;
          const candidate=result.loads.slice();
          candidate[i]=rest;candidate[j]=target;
          const evaluated=rank(candidate.filter(l=>l.stops.length));
          if(better(evaluated,improved))improved=evaluated;
        }
        if(trials>=10000)break;
      }
      if(trials>=10000)break;
    }
    if(improved===result)break;
    result=improved;
  }
  return result.loads;
}

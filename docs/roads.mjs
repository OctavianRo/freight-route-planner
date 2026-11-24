// Fetch directional distances between unique area centres. Reuse the last matrix
// when dispatch changes payload, distance or age settings for the same manifest.
let cached, lastRequest=0;
export async function roadDistances(points,signal){
  const coords=[...new Set(points.map(pt=>pt[1]+','+pt[0]))].sort();
  const key=coords.join(';');
  if(cached?.key===key) return cached.distance;
  const indices=new Map(coords.map((coord,i)=>[coord,i]));
  const matrix=coords.map(()=>[]);
  const groups=[];
  const size=coords.length<=100?100:50;
  for(let i=0;i<coords.length;i+=size) groups.push(coords.slice(i,i+size));
  if(coords.length===1) matrix[0][0]=0;
  else for(const src of groups) for(const dst of groups){
    const local=[...new Set([...src,...dst])];
    const idx=group=>group.map(c=>local.indexOf(c)).join(';');
    const query=new URLSearchParams({annotations:'distance',sources:idx(src),destinations:idx(dst)});
    const wait=Math.max(0,1100-(Date.now()-lastRequest));
    if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
    signal.throwIfAborted();lastRequest=Date.now();
    const response=await fetch('https://routing.openstreetmap.de/routed-car/table/v1/driving/'+local.join(';')+'?'+query,{signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
    if(!response.ok) throw Error('Road routing is unavailable (HTTP '+response.status+'). Try again.');
    const {code,distances}=await response.json();
    if(code!=='Ok'||distances?.length!==src.length) throw Error('Road routing returned an incomplete distance table.');
    for(const [i,from] of src.entries()){
      if(distances[i]?.length!==dst.length) throw Error('Road routing returned an incomplete distance row.');
      for(const [j,to] of dst.entries()){
        const m=distances[i][j];
        matrix[indices.get(from)][indices.get(to)]=Number.isFinite(m)&&m>=0?m/1000:Infinity;
      }
    }
  }
  const byPoint=new Map(points.map(pt=>[pt,indices.get(pt[1]+','+pt[0])]));
  const distance=(a,b)=>matrix[byPoint.get(a)][byPoint.get(b)];
  cached={key,distance};return distance;
}

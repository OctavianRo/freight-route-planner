export function csv(input) {
  const rows = [];
  let row = [], value = '', quoted = false, closed = false;
  const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i <= source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === undefined) throw Error('Unclosed quotation mark in CSV.');
      if (c !== '"') value += c;
      else if (source[i+1] === '"') { value += '"'; i++; }
      else { quoted = false; closed = true; }
    } else if (c === ',' || c === '\n' || c === undefined) {
      row.push(value.trim()); value = ''; closed = false;
      if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else if (c === '"' && !value && !closed) quoted = true;
    else if (c === '"' || closed) throw Error('Unexpected character in quoted CSV field.');
    else value += c;
  }
  return rows;
}
export function location(raw, country, areas) {
  const code = raw.toUpperCase().replace(/\s+/g,'');
  const pattern = country === 'IE' ? /^([A-Z][0-9][0-9W])[A-Z0-9]{4}$/ : /^([A-Z]{1,2}\d[A-Z\d]?)\d[A-Z]{2}$/;
  const district = code.match(pattern)?.[1] ?? code;
  return areas[country][district];
}
export function kilograms(value) {
  const kg = Math.round(Number(value)*1000);
  return /^\d+(\.\d{1,3})?$/.test(String(value)) && Number.isSafeInteger(kg) && kg > 0 ? kg : 0;
}
export function readOrders(input,country,areas) {
  const [header = [], ...rows] = csv(input);
  const cols = header.map(x=>x.toLowerCase());
  for (const key of ['postcode','weight_t','order_date'])
    if (!cols.includes(key)) throw Error('Missing column '+key+'. Use the CSV template.');
  if (new Set(cols).size !== cols.length) throw Error('Duplicate column names.');
  if (!rows.length) throw Error('The CSV contains no orders.');
  return rows.map((row,i)=>{
    const get = k => row[cols.indexOf(k)] || '';
    const postcode = get('postcode'), date = get('order_date'), kg = kilograms(get('weight_t'));
    const pt = location(postcode,country,areas);
    const errors = [];
    if (row.length !== cols.length) errors.push('Wrong number of fields');
    if (!pt) errors.push('Unknown postcode or area');
    if (!kg) errors.push('Enter positive tonnes with up to 3 decimals');
    const time = Date.parse(date+'T00:00:00Z');
    if (!/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0,10)!==date) errors.push('Use a valid YYYY-MM-DD date');
    return {id:get('order_id') || 'Row '+(i+2),postcode,date,kg,weight:get('weight_t'),pt,day:time/86400000,issue:errors.join('. ')};
  });
}
function km(a,b) {
  const rad = Math.PI/180;
  const h = Math.sin((b[0]-a[0])*rad/2)**2 + Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin((b[1]-a[1])*rad/2)**2;
  return 12742*Math.asin(Math.sqrt(Math.min(1,h)));
}
function sequence(stops,depot) {
  const points=[depot,...stops.map(s=>s.pt),depot];
  // Reverse segments when doing so shortens the round trip (bounded 2-opt).
  for(let pass=0;pass<8;pass++){
    let changed=false;
    for(let i=1;i<points.length-2;i++) for(let j=i+1;j<points.length-1;j++){
      const [a,b,c,d]=[points[i-1],points[i],points[j],points[j+1]];
      if(km(a,c)+km(b,d)+0.001>=km(a,b)+km(c,d)) continue;
      points.splice(i,j-i+1,...points.slice(i,j+1).reverse());
      stops.splice(i-1,j-i+1,...stops.slice(i-1,j).reverse());
      changed=true;
    }
    if(!changed) break;
  }
  return points.slice(1).reduce((sum,p,i)=>sum+km(points[i],p),0);
}
export function plan(orders,limit,depot,priority){
  if(!Number.isSafeInteger(limit)||limit<=0||!depot) throw Error('Check the payload and depot.');
  const pending=[], exceptions=[],loads=[];
  for(const o of orders){
    if(o.issue || o.kg>limit) exceptions.push({...o,issue:o.issue || 'Exceeds payload limit'});
    else pending.push(o);
  }
  pending.sort((a,b)=>a.day-b.day);
  while(pending.length){
    const stops=[pending.shift()];
    let kg=stops[0].kg;
    while(true){
      let best=-1,score=Infinity;
      for(let i=0;i<pending.length;i++){
        const o=pending[i];
        if(o.kg+kg>limit) continue;
        const cost=km(stops.at(-1).pt,o.pt)+(o.day-stops[0].day)*priority;
        if(cost<score){best=i;score=cost;}
      }
      if(best<0) break;
      const [next]=pending.splice(best,1); stops.push(next); kg+=next.kg;
    }
    loads.push({stops,kg,km:sequence(stops,depot)});
  }
  return {loads,exceptions};
}

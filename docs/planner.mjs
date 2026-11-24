import {orderDate} from './dates.mjs';
import {optimise} from './optimise.mjs';
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
export const KILCULLEN = [53.130278,-6.744444];
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
  const [header = [], ...rows] = typeof input==='string' ? csv(input) : input.rows;
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
    const parsed=orderDate(date,input.date1904);
    if (!parsed) errors.push('Use a valid DD/MM/YYYY order date');
    return {id:get('order_id') || 'Row '+(i+2),postcode,date:parsed?.display ?? date,kg,weight:get('weight_t'),pt,day:parsed?.day,issue:errors.join('. ')};
  });
}
export function plan(orders,limit,depot,priority,maxKm,distance){
  if(!Number.isSafeInteger(limit)||limit<=0||!depot) throw Error('Check the payload and depot.');
  if(!Number.isFinite(maxKm)||maxKm<=0) throw Error('Enter a positive trip distance limit.');
  const pending=[], exceptions=[], loads=[];
  for(const o of orders){
    let reason=o.issue;
    if(!reason && o.kg>limit) reason='Exceeds payload limit';
    if(!reason){
      const solo=distance(depot,o.pt)+distance(o.pt,depot);
      if(!Number.isFinite(solo)) reason='No complete road route to and from the depot';
      else if(solo>maxKm) reason='Depot round trip is '+solo.toFixed(1)+' km (limit '+maxKm+' km)';
    }
    if(reason) exceptions.push({...o,issue:reason});
    else pending.push(o);
  }
  for(const {stops,kg,km:total} of optimise(pending,{limit,depot,priority,maxKm,distance})){
    const legs=stops.map((o,i)=>distance(stops[i-1]?.pt ?? depot,o.pt));
    loads.push({stops,kg,km:total,legs,depotKm:stops.map(o=>distance(depot,o.pt)),returnKm:distance(stops.at(-1).pt,depot)});
  }
  return {loads,exceptions,maxKm};
}

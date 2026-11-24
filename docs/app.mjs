import {roadDistances} from './roads.mjs';
import {KILCULLEN, readOrders, location, kilograms, plan} from './planner.mjs';
const el=id=>document.getElementById(id);
let controller;
let areas, manifest='', activePlan, revision=0;
const empty=el('result').firstElementChild.cloneNode(true);
function clear(){
  controller?.abort();
  activePlan=null; el('export').hidden=true; el('result').replaceChildren(empty.cloneNode(true));
  el('message').textContent=''; el('generate').disabled=!manifest || !areas;
}
async function load(read,name,example=false){
  const ticket=++revision;
  manifest=''; clear(); el('filename').textContent='Reading manifest…';
  try{
    const source=await read();
    if(ticket!==revision) return;
    if(!source.trim()) throw Error('The manifest is empty.');
    if(example){el('region').value='IE';el('depot').value='Kilcullen';}
    manifest=source;el('filename').textContent=name;clear();
    el('message').textContent='Manifest ready. Check your dispatch settings.';
  }catch(e){if(ticket===revision){el('filename').textContent='Choose a CSV file';el('message').textContent=e.message;}}
}
function file(f){if(f) load(()=>f.text(),f.name);}
el('file').onchange=e=>file(e.target.files[0]);
el('drop').ondragover=e=>{e.preventDefault();el('drop').classList.add('over');};
el('drop').ondragleave=()=>el('drop').classList.remove('over');
el('drop').ondrop=e=>{e.preventDefault();el('drop').classList.remove('over');file(e.dataTransfer.files[0]);};
el('example').onclick=()=>load(async()=>{const r=await fetch('example.csv');if(!r.ok)throw Error('Could not read example.');return r.text();},'Example manifest · 6 orders',true);
el('settings').oninput=clear;
el('region').onchange=()=>{el('depot').value='Kilcullen';clear();};
function node(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
function table(parent,head,rows){
  const t=document.createElement('table');
  const tr=t.createTHead().insertRow();
  head.forEach(h=>tr.append(node('th',h)));
  const body=t.createTBody();
  for(const row of rows){const r=body.insertRow();row.forEach(v=>r.insertCell().textContent=v);}
  parent.append(t);
}
function render({loads,exceptions,maxKm}){
  const root=el('result');root.replaceChildren();
  const summary=node('p',loads.length+' trips · '+loads.reduce((s,l)=>s+l.stops.length,0)+' orders assigned · '+exceptions.length+' to review');
  summary.className='summary';root.append(summary);
  for(const [i,load] of loads.entries()){
    const section=node('section','');section.className='trip';
    section.append(node('h3','Trip '+(i+1)+' · '+(load.kg/1000)+' t'),node('p',el('depot').value+' round trip · '+load.km.toFixed(1)+' / '+maxKm+' road km · '+load.returnKm.toFixed(1)+' km return · '+((kilograms(el('capacity').value)-load.kg)/1000)+' t available'));
    table(section,['Sequence','Order','Destination','Placed','Tonnes','Km from depot','Leg km'],load.stops.map((o,j)=>[j+1,o.id,o.postcode,o.date,o.kg/1000,load.depotKm[j].toFixed(1),load.legs[j].toFixed(1)]));root.append(section);
  }
  if(exceptions.length){
    const section=node('section','');section.className='trip';section.append(node('h3','Orders to review'));
    table(section,['Order','Destination','Tonnes','Reason'],exceptions.map(o=>[o.id,o.postcode,o.weight,o.issue]));root.append(section);
  }
  el('export').hidden=false;
}
el('settings').onsubmit=async e=>{
  e.preventDefault();clear();
  controller=new AbortController();
  const {signal}=controller;
  try{
    const country=el('region').value,base=el('depot').value.trim().toLowerCase()==='kilcullen'?KILCULLEN:location(el('depot').value,country,areas);
    if(!base)throw Error('Depot not recognised. Check the region and enter a postcode or area.');
    const orders=readOrders(manifest,country,areas), payload=kilograms(el('capacity').value);
    el('generate').disabled=true;el('message').textContent='Calculating road distances…';
    const distance=await roadDistances([base,...orders.filter(o=>!o.issue && o.kg<=payload).map(o=>o.pt)],signal);
    if(signal.aborted)return;
    activePlan=plan(orders,payload,base,Number(el('priority').value),Number(el('maxKm').value),distance);
    el('message').textContent='';
    render(activePlan);
  }catch(err){if(!signal.aborted)el('message').textContent='Could not generate plan. '+err.message;}
  finally{if(!signal.aborted)el('generate').disabled=false;}
};
el('export').onclick=()=>{
  if(!activePlan)return;
  const rows=[['trip','sequence','depot','order_id','postcode','order_date','weight_t','issue','leg_km','return_to_depot_km','trip_km','trip_limit_km','direct_from_depot_km']];
  const add=(o,t,s,leg="",back="",total="",direct="")=>rows.push([t,s,el('depot').value,o.id,o.postcode,o.date,o.weight,o.issue,leg,back,total,activePlan.maxKm,direct]);
  activePlan.loads.forEach((l,i)=>l.stops.forEach((o,j)=>add(o,i+1,j+1,l.legs[j].toFixed(3),j===l.stops.length-1?l.returnKm.toFixed(3):"",l.km.toFixed(3),l.depotKm[j].toFixed(3))));
  activePlan.exceptions.forEach(o=>add(o,'',''));
  function field(v){const raw=String(v);const safe=/^[=+@\-\t\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"';}
  const url=URL.createObjectURL(new Blob([rows.map(r=>r.map(field).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=node('a','');a.href=url;a.download='load-plan.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try{const response=await fetch('areas.json');if(!response.ok)throw Error();areas=await response.json();el('generate').disabled=!manifest;}
catch{el('message').textContent='Could not load postcode locations. Refresh to try again.';}

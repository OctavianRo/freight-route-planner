import test from 'node:test';
import assert from 'node:assert/strict';
import {utils,write} from '../docs/vendor/xlsx.mjs';
import {workbookManifest} from '../docs/workbook.mjs';
import {orderDate} from '../docs/dates.mjs';
import {plan,readOrders} from '../docs/planner.mjs';

test('day-first input, legacy ISO, leap days and invalid dates',()=>{
  assert.deepEqual(orderDate('2/11/2026'),orderDate('2026-11-02'));
  assert.equal(orderDate('2/11/2026').display,'02/11/2026');
  assert.equal(orderDate('29/02/2024').display,'29/02/2024');
  for(const invalid of ['31/04/2026','29/02/2025','60',''])assert.equal(orderDate(invalid),null);
});

for(const date1904 of [false,true]){
  test('workbook import reads native date cells with date1904='+date1904,()=>{
    const book=utils.book_new();
    const midnight=Date.UTC(2026,10,2);
    const epoch=date1904 ? Date.UTC(1904,0,1) : Date.UTC(1899,11,30);
    const worksheet=utils.aoa_to_sheet([['order_id','postcode','weight_t','order_date'],['A','D02',8,(midnight-epoch)/86400000+0.5]]);
    worksheet.D2.z='dd/mm/yyyy';
    book.Workbook={WBProps:{date1904}};
    utils.book_append_sheet(book,worksheet,'Orders');
    const manifest=workbookManifest(write(book,{type:'buffer',bookType:'xlsx'}));
    const [order]=readOrders(manifest,'IE',{IE:{D02:[53,-6]}});
    assert.equal(order.date,'02/11/2026');assert.equal(order.issue,'');
    assert.equal(order.day,midnight/86400000);
  });
}

test('finds two full trips where oldest-first packing needs three',()=>{
  const orders=[4,4,6,6].map((weight,i)=>({id:i,kg:weight*1000,day:i,pt:1}));
  const {loads}=plan(orders,10000,2,8,500,(a,b)=>a===b?0:50);
  assert.deepEqual(loads.map(l=>l.kg),[10000,10000]);
  assert.deepEqual(loads.flatMap(l=>l.stops.map(o=>o.id)).sort(),[0,1,2,3]);
  assert(loads[0].stops.includes(orders[0]));
});

test('every assigned trip respects asymmetric distances, payload and depot return',()=>{
  const matrix=[[0,50,60,90],[80,0,40,30],[70,10,0,20],[140,15,100,0]];
  const orders=[1,2,3,1,2,3].map((pt,id)=>({id,pt,day:id,kg:6000}));
  const {loads,exceptions}=plan(orders,15000,'0',8,180,(a,b)=>matrix[a][b]);
  assert.deepEqual(exceptions.map(o=>o.id),[2,5]);
  for(const l of loads){
    assert(l.km<=180 && l.kg<=15000);
    assert.equal(l.km,l.legs.reduce((s,v)=>s+v,l.returnKm));
  }
  assert.equal(new Set([...exceptions,...loads.flatMap(l=>l.stops)].map(o=>o.id)).size,6);
});

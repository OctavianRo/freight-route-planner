import {orderDate} from './dates.mjs';
import {read,utils,writeFile} from './vendor/xlsx.mjs';

export function workbookManifest(buffer) {
  const book=read(buffer,{type:'array',sheets:0});
  const sheet=book.Sheets[book.SheetNames[0]];
  if(!sheet) throw Error('Put the order manifest on the first worksheet.');
  const rows=utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:false});
  return {rows:rows.map(row=>row.map(value=>String(value).trim())),date1904:!!book.Workbook?.WBProps?.date1904};
}

export function planWorkbook(rows){
  const [headers,...body]=rows;
  const dateColumn=headers.indexOf('order_date');
  const data=body.map(row=>row.map((value,column)=>{
    if(value==='')return value;
    if(column===dateColumn){
      const parsed=orderDate(value);
      if(!parsed)return value;
      // The new workbook uses the default 1900 date system.
      return parsed.day+25569-(parsed.day<-25508 ? 1 : 0);
    }
    if(/^(?:weight_t|.*_km)$/.test(headers[column]) && Number.isFinite(Number(value)))return Number(value);
    return value;
  }));
  const sheet=utils.aoa_to_sheet([headers,...data]);
  for(let i=1;i<=body.length;i++){
    const cell=sheet[utils.encode_cell({r:i,c:dateColumn})];
    if(cell?.t==='n')cell.z='dd/mm/yyyy';
  }
  sheet['!cols']=headers.map(h=>({wch:Math.max(16,h.length+2,h==='issue'?50:0)}));
  const book=utils.book_new();
  utils.book_append_sheet(book,sheet,'Load plan');
  return book;
}
export function downloadPlan(rows){
  writeFile(planWorkbook(rows),'load-plan.xlsx');
}

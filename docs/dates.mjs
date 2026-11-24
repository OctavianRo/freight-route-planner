// Irish Excel short dates are day first. Use UTC throughout so DST never
// changes an order's age. Excel's 1900 system includes a fictitious leap day.
export function orderDate(value, date1904=false) {
  const raw=String(value).trim();
  let iso;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serial=Math.floor(Number(raw));
    if (serial>2958465 || (!date1904 && (serial===60 || serial===0))) return null;
    const epoch=date1904 ? Date.UTC(1904,0,1) : Date.UTC(1899,11,31);
    const time=epoch+(serial-(!date1904 && serial>60 ? 1 : 0))*86400000;
    iso=new Date(time).toISOString().slice(0,10);
  } else {
    const parts=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    iso=parts ? [parts[3],parts[2].padStart(2,'0'),parts[1].padStart(2,'0')].join('-') : raw;
  }
  if (!/^\d{4}-\d\d-\d\d$/.test(iso)) return null;
  const time=Date.parse(iso+'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10)!==iso) return null;
  return {display:iso.split('-').reverse().join('/'),day:time/86400000};
}

import { saveReal, getReal, getYear } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';
import { parseXLSX, parseXLS } from '../../vendor/xlsx-lite.js';

function parseCSV(text){
  // autodetect delimiter ; , or tab
  const firstLine = text.split(/\r?\n/).find(Boolean) || '';
  let delim = ';'; if(firstLine.includes(',')) delim=','; if(firstLine.includes('\t')) delim='\t';
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(new RegExp(delim));
  return lines.map(l=>{
    const cols = l.split(new RegExp(delim));
    const obj = {}; head.forEach((h,i)=> obj[h.trim().toLowerCase()] = cols[i]||''); return obj;
  });
}

async function readFile(file){
  const name = file.name.toLowerCase();
  if(name.endsWith('.csv')){
    const text = await file.text();
    const rows = parseCSV(text);
    return rows.map(r=>({ raw:r }));
  }
  if(name.endsWith('.xlsx')){
    const rows = await parseXLSX(file); // returns array of arrays
    const head = rows.shift()||[];
    return rows.map(r=>{ const o={}; head.forEach((h,i)=>o[h?.toString().trim().toLowerCase()]=r[i]); return {raw:o}; });
  }
  if(name.endsWith('.xls')){
    const rows = await parseXLS(file);
    const head = rows.shift()||[];
    return rows.map(r=>{ const o={}; head.forEach((h,i)=>o[h?.toString().trim().toLowerCase()]=r[i]); return {raw:o}; });
  }
  alert('Formato no soportado. Usa .CSV, .XLS o .XLSX'); return [];
}

const view = {
  route:'#/importar', title:'Importar',
  async mount(root){
    root.innerHTML = `<div class="row"><div class="col"><div class="card">
      <h1>Importar movimientos</h1>
      <div class="small muted">Mapea columnas. No se tocan los ficheros originales.</div>
      <div style="margin:10px 0; display:flex; gap:10px; align-items:center;">
        <input type="file" id="file" accept=".csv,.xls,.xlsx"/>
        <button class="primary" id="load">Cargar</button>
      </div>
      <div class="row" id="mapper" style="display:none; gap:10px;">
        <label>Fecha <select id="map-date"></select></label>
        <label>Concepto <select id="map-concept"></select></label>
        <label>Importe <select id="map-amount"></select></label>
        <label>Banco/IBAN (opcional) <select id="map-bank"></select></label>
        <button id="apply" class="primary">Aplicar mapeo + Guardar</button>
      </div>
      <div class="grid" style="margin-top:12px;"><table id="preview"></table></div>
    </div></div></div>`;

    const fileEl = root.querySelector('#file');
    const loadBtn = root.querySelector('#load');
    const mapper = root.querySelector('#mapper');
    const table = root.querySelector('#preview');
    let parsed = [];

    loadBtn.onclick = async ()=>{
      const f = fileEl.files?.[0]; if(!f){ alert('Selecciona un archivo'); return; }
      parsed = await readFile(f);
      if(!parsed.length){ alert('No se han podido leer filas'); return; }
      const cols = Object.keys(parsed[0].raw);
      ['map-date','map-concept','map-amount','map-bank'].forEach(id=>{
        const sel = root.querySelector('#'+id); sel.innerHTML = cols.map(c=>`<option>${c}</option>`).join('');
      });
      // preview
      const first10 = parsed.slice(0,10);
      table.innerHTML = '<thead><tr>'+Object.keys(parsed[0].raw).map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>'+
        first10.map(r=>'<tr>'+Object.values(r.raw).map(v=>`<td>${v??''}</td>`).join('')+'</tr>').join('')+'</tbody>';
      mapper.style.display='flex';
    };

    root.querySelector('#apply').onclick = ()=>{
      const cDate = root.querySelector('#map-date').value;
      const cConcept = root.querySelector('#map-concept').value;
      const cAmount = root.querySelector('#map-amount').value;
      const cBank = root.querySelector('#map-bank').value;
      const y = getYear();
      const existing = getReal(y);
      const mapped = parsed.map(r=>{
        const o=r.raw;
        // fecha dd/mm/aaaa o yyyy-mm-dd
        let d=(o[cDate]||'').toString().trim();
        if(/\d{2}\/\d{2}\/\d{4}/.test(d)){ const [dd,mm,yy]=d.split('/'); d=`${yy}-${mm}-${dd}`; }
        const concept=(o[cConcept]||'').toString();
        const amount=parseEuro(o[cAmount]);
        const bank=(o[cBank]||'SIN_BANCO').toString().trim()||'SIN_BANCO';
        return {date:d,bank,concept,amount};
      }).filter(x=>x.date);
      saveReal(existing.concat(mapped), y);
      alert(`Importadas ${mapped.length} filas.`);
    };
  }
};
export default view;

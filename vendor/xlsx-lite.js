// xlsx-lite.js — lector .xlsx (ZIP) y .xls (HTML <table>) sin dependencias
// Devuelve Array<Array<any>>

export async function parseXLS(file){
  // Muchos bancos exportan .xls que realmente es HTML
  const text = await file.text();
  if(!/</.test(text)) throw new Error('XLS no es HTML con <table>');
  const doc = new DOMParser().parseFromString(text,'text/html');
  const table = doc.querySelector('table');
  const rows = [];
  if(table){
    for(const tr of table.querySelectorAll('tr')){
      const cols=[]; for(const td of tr.children) cols.push(td.textContent.trim());
      rows.push(cols);
    }
  }
  return rows;
}

export async function parseXLSX(file){
  const ab = await file.arrayBuffer();
  const u8 = new Uint8Array(ab);
  const dv = new DataView(ab);

  function readU32LE(o){ return dv.getUint32(o, true); }
  function readU16LE(o){ return dv.getUint16(o, true); }

  // EOCD
  const SIG_EOCD = 0x06054b50, SIG_CEN = 0x02014b50, SIG_LOC = 0x04034b50;
  let eocd = -1;
  for(let i=u8.length-22; i>=0 && i>u8.length-70000; i--){
    if(readU32LE(i)===SIG_EOCD){ eocd = i; break; }
  }
  if(eocd<0) throw new Error('ZIP EOCD no encontrado');
  const cdOffset = readU32LE(eocd+16);
  const cdSize = readU32LE(eocd+12);

  // Leer central directory
  const files = {};
  let p = cdOffset;
  while(p < cdOffset+cdSize){
    const sig = readU32LE(p); if(sig!==SIG_CEN) break;
    const compMethod = readU16LE(p+10);
    const compSize = readU32LE(p+20);
    const uncompSize = readU32LE(p+24);
    const nameLen = readU16LE(p+28);
    const extraLen = readU16LE(p+30);
    const commentLen = readU16LE(p+32);
    const relOffset = readU32LE(p+42);
    const name = new TextDecoder().decode(u8.slice(p+46, p+46+nameLen));
    files[name] = {compMethod, compSize, uncompSize, relOffset, name};
    p += 46 + nameLen + extraLen + commentLen;
  }

  async function inflateRaw(slice){
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Response(new Blob([slice]).stream().pipeThrough(ds));
    return new Uint8Array(await stream.arrayBuffer());
  }
  async function readFile(entryName){
    const f = files[entryName];
    if(!f) return null;
    const off = f.relOffset;
    if(readU32LE(off)!==SIG_LOC) throw new Error('Local header invalido');
    const nameLen = readU16LE(off+26);
    const extraLen = readU16LE(off+28);
    const start = off + 30 + nameLen + extraLen;
    const comp = u8.slice(start, start + f.compSize);
    if(f.compMethod===0) return comp;
    if(f.compMethod===8) return await inflateRaw(comp);
    throw new Error('Método ZIP no soportado: '+f.compMethod);
  }

  // localizar worksheet principal
  // Intentamos workbook para saber hoja activa, si no, sheet1
  let targetSheet = 'xl/worksheets/sheet1.xml';
  for(const k of Object.keys(files)){
    if(/^xl\/worksheets\/sheet\d+\.xml$/.test(k)){ targetSheet = targetSheet || k; if(k.endsWith('sheet1.xml')) targetSheet=k; }
  }
  const ssData = await readFile('xl/sharedStrings.xml');
  const shared = [];
  if(ssData){
    const xml = new TextDecoder().decode(ssData);
    const doc = new DOMParser().parseFromString(xml,'application/xml');
    doc.querySelectorAll('si').forEach(si=> shared.push(si.textContent));
  }
  const wsData = await readFile(targetSheet);
  if(!wsData) throw new Error('No se encontró la hoja de cálculo');
  const wsXML = new TextDecoder().decode(wsData);
  const ws = new DOMParser().parseFromString(wsXML,'application/xml');
  const rows = [];
  ws.querySelectorAll('row').forEach(r=>{
    const arr=[];
    r.querySelectorAll('c').forEach(c=>{
      const t = c.getAttribute('t');
      const v = c.querySelector('v')?.textContent || '';
      if(t==='s'){ // shared string
        arr.push(shared[parseInt(v,10)] ?? '');
      }else{
        arr.push(v);
      }
    });
    rows.push(arr);
  });
  return rows;
}

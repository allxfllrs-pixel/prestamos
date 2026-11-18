/* Código compartido por Préstamos y Vehículos:
   conexión con Supabase, pantalla de clave, menú "⋯", ventana de abono con recibo y recordatorio de respaldo. */

/* ---------- conexión ---------- */
const SB_URL = 'https://rgybhbofsmnwsxzratex.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJneWJoYm9mc21ud3N4enJhdGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2NzcwNTIsImV4cCI6MjExMDI1MzA1Mn0.ORVlGYMNMH57GbyCc9sEUeZzNnJcygUyhyE-YQI390w';
const SB_HEADERS = {'apikey':SB_KEY, 'Authorization':'Bearer '+SB_KEY, 'Content-Type':'application/json'};

function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }

const CLAVE_LS = 'prestamos_clave';   // la misma clave sirve para las dos secciones
let clave = lsGet(CLAVE_LS);

/* Llama una función de la base de datos. Las funciones responden {"error": "..."} cuando algo falla. */
async function rpc(fn, args){
  const r = await fetch(SB_URL+'/rest/v1/rpc/'+fn, {method:'POST', headers:SB_HEADERS, body:JSON.stringify(args), cache:'no-store'});
  let j = null; try{ j = await r.json(); }catch(e){}
  const msg = !r.ok ? ((j && j.message) || ('Error '+r.status))
            : (j && typeof j==='object' && !Array.isArray(j) && j.error) ? j.error : null;
  if(msg){
    const err = new Error(msg);
    // 401 solo cuando la base de datos dice que la clave es incorrecta (no por errores que mencionan "p_clave")
    err.status = /clave (actual )?es incorrecta|^clave incorrecta/i.test(msg) ? 401 : (r.ok ? 400 : r.status);
    throw err;
  }
  return j;
}
/* Lee una tabla con la clave. Si la función todavía no existe (falta seguridad.sql), usa la lectura antigua. */
async function leerFilas(tabla){
  try{
    const j = await rpc('listar_'+tabla, {p_clave: clave||''});
    return (j && j.filas) || [];
  }catch(e){
    if(e.status !== 404) throw e;
    const r = await fetch(SB_URL+'/rest/v1/'+tabla+'?select=id,datos,actualizado&order=id', {headers:SB_HEADERS, cache:'no-store'});
    if(!r.ok){ const er = new Error('Error '+r.status); er.status = r.status; throw er; }
    return r.json();
  }
}
async function claveValida(c){ return (await rpc('verificar_clave', {p_clave:c})) === true; }

/* ---------- estilos compartidos (usan los colores de cada página) ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
body.bloqueado > header, body.bloqueado > main{display:none}
.acceso{min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px 16px}
.acceso form{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;width:100%;max-width:360px;box-shadow:var(--shadow);display:grid;gap:12px}
.acceso h1{margin:0;font-size:22px}
.acceso p{margin:0;color:var(--muted);font-size:14px}
.acceso .volver{color:var(--muted);text-decoration:none;font-size:14px}
.acceso .err{color:var(--danger);font-size:13px}
.acceso button{padding:10px 14px;font-weight:600}
details.mas{position:relative}
details.mas > summary{list-style:none;cursor:pointer;padding:8px 12px;border-radius:8px;background:var(--head-btn);border:1px solid rgba(255,255,255,.3);color:var(--on-primary);font-weight:700;line-height:1.2;user-select:none}
details.mas > summary::-webkit-details-marker{display:none}
details.mas .menu{position:absolute;right:0;top:calc(100% + 6px);background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);min-width:230px;padding:6px;z-index:20;display:grid}
details.mas .menu button{background:transparent;border:0;text-align:left;padding:10px 12px;border-radius:8px;color:var(--text)}
details.mas .menu button:hover{background:var(--soft)}
.tel504{display:flex;align-items:stretch}
.tel504 span{display:flex;align-items:center;padding:0 10px;border:1px solid var(--line);border-right:0;border-radius:8px 0 0 8px;background:var(--soft);color:var(--text);font-size:14px;white-space:nowrap}
.tel504 input{border-radius:0 8px 8px 0;min-width:0}
.respaldo{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:14px}
.ab-rapidos{display:flex;gap:6px;flex-wrap:wrap}
.ab-rapidos button{padding:4px 10px;font-size:13px}
.ab-ok{text-align:center;display:grid;gap:10px;padding:6px 0}
.ab-ok .big{font-size:40px;line-height:1}
.ab-ok a.wa{display:block;text-align:center;text-decoration:none;font-weight:600;padding:12px;border-radius:10px;background:#1fa855;color:#fff}
</style>`);

/* ---------- pantalla de clave ---------- */
/* Si hay una clave guardada y es válida, entra directo; si no, muestra la pantalla de clave. */
async function iniciarAcceso(titulo, alEntrar){
  if(clave){
    let valida = true;
    try{ valida = await claveValida(clave); }catch(e){ /* sin conexión: se intenta con la clave guardada */ }
    if(valida){ alEntrar(); return; }
    lsDel(CLAVE_LS); clave = null;
  }
  document.body.classList.add('bloqueado');
  const motivo = (()=>{ try{ const m = sessionStorage.getItem('acceso_motivo'); sessionStorage.removeItem('acceso_motivo'); return m; }catch(e){ return null; } })();
  const div = document.createElement('div');
  div.className = 'acceso';
  div.innerHTML = `<form>
      <a class="volver" href="./">← Inicio</a>
      <h1>🔒 ${titulo}</h1>
      <p>Escribe tu clave para ver y registrar los datos. Solo la pides una vez en este dispositivo.</p>
      <div><label for="acc_clave">Clave</label><input id="acc_clave" type="password" autocomplete="current-password" required></div>
      <div class="err" ${motivo?'':'hidden'}>${motivo||''}</div>
      <button class="primary" type="submit">Entrar</button>
    </form>`;
  document.body.prepend(div);
  const input = div.querySelector('input'), err = div.querySelector('.err'), btn = div.querySelector('button');
  input.focus();
  div.querySelector('form').addEventListener('submit', async e=>{
    e.preventDefault();
    btn.disabled = true; err.hidden = true;
    try{
      if(!await claveValida(input.value.trim())){ err.textContent = 'Clave incorrecta.'; err.hidden = false; input.select(); return; }
      clave = input.value.trim(); lsSet(CLAVE_LS, clave);
      div.remove(); document.body.classList.remove('bloqueado');
      alEntrar();
    }catch(ex){ err.textContent = ex && ex.status ? ex.message : 'No hay conexión. Revisa tu internet.'; err.hidden = false; }
    finally{ btn.disabled = false; }
  });
}
/* Cierra la sesión en este dispositivo (borra la clave guardada). */
function salir(motivo){
  lsDel(CLAVE_LS);
  if(motivo){ try{ sessionStorage.setItem('acceso_motivo', motivo); }catch(e){} }
  location.reload();
}
/* Si la base de datos rechaza la clave (por ejemplo, la cambiaron en otro dispositivo), pide entrar de nuevo. */
function claveRechazada(e){ if(e && e.status === 401){ salir('La clave cambió. Escríbela de nuevo.'); return true; } return false; }

/* ---------- menú "⋯" ---------- */
function montarMenu(idContenedor, items){
  const cont = document.getElementById(idContenedor);
  cont.innerHTML = `<details class="mas"><summary aria-label="Más opciones">⋯</summary><div class="menu"></div></details>`;
  const det = cont.querySelector('details'), menu = cont.querySelector('.menu');
  for(const [texto, fn] of items){
    const b = document.createElement('button'); b.type = 'button'; b.textContent = texto;
    b.onclick = () => { det.open = false; fn(); };
    menu.appendChild(b);
  }
  document.addEventListener('click', e=>{ if(det.open && !det.contains(e.target)) det.open = false; });
}

/* ---------- recordatorio de copia de seguridad (cada 7 días) ---------- */
function marcarRespaldo(seccion){ lsSet('respaldo_'+seccion, new Date().toISOString().slice(0,10)); revisarRespaldo(seccion); }
function revisarRespaldo(seccion, hayDatos, exportar){
  const el = document.getElementById('respaldoAviso'); if(!el) return;
  if(exportar) el._exportar = exportar;
  if(hayDatos === false){ el.hidden = true; return; }
  const ult = lsGet('respaldo_'+seccion);
  const dias = ult ? Math.floor((Date.now() - new Date(ult+'T00:00:00')) / 86400000) : null;
  if(dias !== null && dias < 7){ el.hidden = true; return; }
  el.hidden = false;
  el.className = 'respaldo';
  el.innerHTML = `<span>📦 ${dias===null ? 'Todavía no has descargado una copia de seguridad.' : `Hace ${dias} días que no descargas una copia de seguridad.`} Guárdala por si algo se borra.</span>
    <button class="small primary" type="button">⬇ Descargar ahora</button>`;
  el.querySelector('button').onclick = () => el._exportar && el._exportar();
}

/* ---------- copias automáticas (las guarda Supabase cada noche, 30 días) ---------- */
/* seccion: 'prestamos' o 'vehiculos'. Descarga la copia elegida en el mismo formato que "Descargar copia de seguridad". */
async function verCopiasAuto(seccion){
  let ov = document.getElementById('ovCopias');
  if(!ov){
    ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'ovCopias';
    ov.innerHTML = `<div class="modal chico">
      <div class="head"><h2>Copias automáticas</h2><button class="small" type="button" data-cerrar aria-label="Cerrar">✕</button></div>
      <div id="copiasCuerpo"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e=>{ if(e.target === ov) ov.classList.remove('open'); });
    ov.querySelector('[data-cerrar]').onclick = () => ov.classList.remove('open');
  }
  const cuerpo = ov.querySelector('#copiasCuerpo');
  cuerpo.innerHTML = '<p style="color:var(--muted)">Cargando…</p>';
  ov.classList.add('open');
  const nombre = seccion === 'prestamos' ? 'préstamos' : 'vehículos';
  try{
    const copias = (await rpc('listar_respaldos_auto', {p_clave: clave||''})).copias || [];
    if(!copias.length){ cuerpo.innerHTML = '<p>Todavía no hay copias. La primera se guarda esta noche.</p>'; return; }
    cuerpo.innerHTML = `<p style="color:var(--muted);font-size:14px;margin-top:0">Cada noche se guarda una copia sola y se conservan 30 días.
        Para volver a una copia: descárgala y luego usa <b>⋯ → Restaurar copia de seguridad</b>.</p>
      <div class="tablewrap"><table><thead><tr><th>Fecha</th><th class="n">${nombre[0].toUpperCase()+nombre.slice(1)}</th><th></th></tr></thead>
      <tbody>${copias.map(c=>`<tr><td>${new Date(c.fecha).toLocaleString('es',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})}</td>
        <td class="n">${c[seccion]}</td><td class="n"><button class="small" type="button" data-id="${c.id}">⬇ Descargar</button></td></tr>`).join('')}</tbody></table></div>`;
    cuerpo.querySelectorAll('button[data-id]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try{
        const r = await rpc('obtener_respaldo_auto', {p_clave: clave||'', p_id: +b.dataset.id});
        const blob = new Blob([JSON.stringify(r[seccion] || [], null, 2)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `copia-automatica-${seccion}-${String(r.fecha).slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
      }catch(e){ if(!claveRechazada(e)) alertaCopias(cuerpo, e); }
      finally{ b.disabled = false; }
    });
  }catch(e){
    if(claveRechazada(e)) return;
    cuerpo.innerHTML = '';
    alertaCopias(cuerpo, e);
  }
}
function alertaCopias(cuerpo, e){
  cuerpo.insertAdjacentHTML('afterbegin', e && e.status === 404
    ? '<p class="aviso">Las copias automáticas todavía no están activadas. Falta ejecutar <b>respaldo_auto.sql</b> en Supabase.</p>'
    : `<p class="aviso">${e && e.message ? e.message : 'No hay conexión.'}</p>`);
}

/* ---------- factura / recibo en imagen ----------
   d = {seccion, color, titulo, numero, fecha (Date), cliente: [[etiqueta, valor]], filas: [{t, v, nota, color:'ok'|'bad', fuerte} | {seccion}],
        totalLabel, total, estado: {texto, ok}, pie, tel, archivo} */
function nombreNegocio(){ return lsGet('negocio_nombre') || 'Mis Negocios'; }
function _lineas(g, texto, max){
  const palabras = String(texto ?? '').split(/\s+/); const out = []; let cur = '';
  for(const w of palabras){
    const prueba = cur ? cur + ' ' + w : w;
    if(g.measureText(prueba).width > max && cur){ out.push(cur); cur = w; } else cur = prueba;
  }
  if(cur) out.push(cur);
  return out.length ? out : [''];
}
async function dibujarFactura(d){
  try{ await document.fonts.ready; }catch(e){}
  const W = 1080, M = 44, X0 = M + 56, X1 = W - M - 56, ANCHO = X1 - X0;
  const TINTA = '#1d232b', GRIS = '#6b7380', LINEA = '#c9ced6', OK = '#1e8e4e', MAL = '#c0392b', ACENTO = d.color || '#2f2fb8';
  const F = (peso, tam, mono) => `${peso} ${tam}px ${mono ? 'ui-monospace, Consolas, monospace' : 'Inter, system-ui, sans-serif'}`;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const ops = [];                         // cada bloque: {h, draw(y)}
  const add = (h, draw) => ops.push({h, draw: draw || (()=>{})});
  const sep = () => add(44, y => { g.strokeStyle = LINEA; g.lineWidth = 3; g.setLineDash([14, 12]); g.beginPath(); g.moveTo(X0, y+22); g.lineTo(X1, y+22); g.stroke(); g.setLineDash([]); });

  // encabezado
  add(30);
  add(60, y => { g.fillStyle = TINTA; g.font = F(800, 48); g.textAlign = 'center'; g.fillText(nombreNegocio(), W/2, y+48); });
  add(44, y => { g.fillStyle = GRIS; g.font = F(500, 28); g.textAlign = 'center'; g.fillText(d.seccion || '', W/2, y+32); });
  add(18);
  add(70, y => { g.fillStyle = ACENTO; g.beginPath(); g.roundRect(X0, y, ANCHO, 64, 14); g.fill();
    g.fillStyle = '#fff'; g.font = F(800, 32); g.textAlign = 'center'; g.fillText(d.titulo, W/2, y+44); });
  add(16);
  add(40, y => { g.font = F(600, 26); g.fillStyle = GRIS; g.textAlign = 'left'; g.fillText('No. ' + (d.numero || ''), X0, y+28);
    g.textAlign = 'right'; g.fillText((d.fecha || new Date()).toLocaleDateString('es', {day:'2-digit', month:'short', year:'numeric'}), X1, y+28); });
  sep();

  // cliente
  for(const [k, v] of (d.cliente || [])){
    g.font = F(600, 28); const ls = _lineas(g, v, ANCHO - 230);
    add(16 + ls.length * 38, y => {
      g.textAlign = 'left'; g.fillStyle = GRIS; g.font = F(500, 26); g.fillText(k, X0, y+30);
      g.fillStyle = TINTA; g.font = F(600, 28); ls.forEach((l, i) => g.fillText(l, X0 + 230, y + 30 + i*38));
    });
  }
  sep();

  // detalle
  for(const f of (d.filas || [])){
    if(f.seccion){
      add(52, y => { g.textAlign = 'left'; g.fillStyle = ACENTO; g.font = F(800, 24); g.fillText(String(f.seccion).toUpperCase(), X0, y+36); });
      continue;
    }
    g.font = F(f.fuerte ? 700 : 500, f.fuerte ? 32 : 28);
    const ls = _lineas(g, f.t, ANCHO * 0.62);
    g.font = F(500, 23); const ns = f.nota ? _lineas(g, f.nota, ANCHO * 0.62) : [];
    const lh = f.fuerte ? 42 : 38;
    add(12 + ls.length * lh + ns.length * 30 + 4, y => {
      const col = f.color === 'ok' ? OK : f.color === 'bad' ? MAL : TINTA;
      g.textAlign = 'left'; g.fillStyle = TINTA; g.font = F(f.fuerte ? 700 : 500, f.fuerte ? 32 : 28);
      ls.forEach((l, i) => g.fillText(l, X0, y + 34 + i*lh));
      g.fillStyle = GRIS; g.font = F(500, 23);
      ns.forEach((l, i) => g.fillText(l, X0, y + 34 + ls.length*lh - 6 + i*30));
      g.textAlign = 'right'; g.fillStyle = col; g.font = F(f.fuerte ? 800 : 700, f.fuerte ? 34 : 28, true);
      g.fillText(f.v ?? '', X1, y + 34);
    });
  }
  sep();

  // total
  add(84, y => {
    g.textAlign = 'left'; g.fillStyle = TINTA; g.font = F(800, 32); g.fillText(String(d.totalLabel || 'Total').toUpperCase(), X0, y+54);
    g.textAlign = 'right'; g.fillStyle = d.estado && !d.estado.ok ? MAL : TINTA; g.font = F(800, 46, true); g.fillText(d.total || '', X1, y+56);
  });
  // sello
  if(d.estado){
    add(130, y => {
      const col = d.estado.ok ? OK : MAL;
      g.save(); g.translate(W/2, y+62); g.rotate(-0.05);
      g.font = F(900, 40); const w = g.measureText(d.estado.texto).width + 70;
      g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.roundRect(-w/2, -38, w, 76, 16); g.stroke();
      g.fillStyle = col; g.textAlign = 'center'; g.fillText(d.estado.texto, 0, 14);
      g.restore();
    });
  }
  sep();
  add(48, y => { g.textAlign = 'center'; g.fillStyle = TINTA; g.font = F(700, 30); g.fillText(d.pie || '¡Gracias!', W/2, y+34); });
  add(40, y => { g.textAlign = 'center'; g.fillStyle = GRIS; g.font = F(500, 22);
    g.fillText('Generado el ' + new Date().toLocaleString('es', {day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit'}), W/2, y+28); });
  add(40);

  // tamaño final y dibujo
  const altoPapel = ops.reduce((t, o) => t + o.h, 0), H = altoPapel + M*2;
  c.width = W; c.height = H;
  g.fillStyle = '#e9edf2'; g.fillRect(0, 0, W, H);
  // papel con bordes de sierra arriba y abajo
  const diente = 22, top = M, bot = M + altoPapel;
  g.save(); g.shadowColor = 'rgba(0,0,0,.12)'; g.shadowBlur = 24; g.shadowOffsetY = 6;
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(M, top + diente);
  for(let x = M; x < W - M; x += diente*2){ g.lineTo(x + diente, top); g.lineTo(Math.min(x + diente*2, W - M), top + diente); }
  g.lineTo(W - M, bot - diente);
  for(let x = W - M; x > M; x -= diente*2){ g.lineTo(x - diente, bot); g.lineTo(Math.max(x - diente*2, M), bot - diente); }
  g.closePath(); g.fill(); g.restore();
  let y = top + 4;
  for(const o of ops){ o.draw(y); y += o.h; }
  return c;
}
let _factura = null;
async function enviarFactura(d){
  let ov = document.getElementById('ovFactura');
  if(!ov){
    ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'ovFactura';
    ov.innerHTML = `<div class="modal chico">
      <div class="head"><h2>🧾 Recibo en imagen</h2><button class="small" type="button" data-cerrar aria-label="Cerrar">✕</button></div>
      <img id="facImg" alt="Recibo" style="width:100%;max-height:58vh;object-fit:contain;border-radius:10px;background:#e9edf2;display:block">
      <div style="margin-top:10px"><label for="facNegocio">Nombre de tu negocio (sale arriba del recibo)</label>
        <input id="facNegocio" autocomplete="off"></div>
      <div id="facMsg" class="preview" style="margin-top:10px" hidden></div>
      <div class="actions">
        <button type="button" id="facBajar">⬇ Descargar</button>
        <button type="button" class="primary" id="facEnviar">📤 Enviar por WhatsApp</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e=>{ if(e.target === ov) ov.classList.remove('open'); });
    ov.querySelector('[data-cerrar]').onclick = () => ov.classList.remove('open');
    ov.querySelector('#facNegocio').addEventListener('change', e=>{ lsSet('negocio_nombre', e.target.value.trim()); _factura.blob = null; _factura.listo = prepararFactura(); });
    ov.querySelector('#facBajar').onclick = () => {
      if(!_factura || !_factura.blob) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(_factura.blob); a.download = _factura.archivo;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    };
    ov.querySelector('#facEnviar').onclick = compartirFactura;
  }
  _factura = {d, blob:null, archivo:(d.archivo || 'recibo') + '.png'};
  ov.querySelector('#facNegocio').value = nombreNegocio();
  ov.querySelector('#facMsg').hidden = true;
  ov.classList.add('open');
  _factura.listo = prepararFactura();
  await _factura.listo;
}
async function prepararFactura(){
  const ov = document.getElementById('ovFactura'); if(!_factura) return;
  const canvas = await dibujarFactura(_factura.d);
  ov.querySelector('#facImg').src = canvas.toDataURL('image/png');
  _factura.blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
}
/* Teléfono: menú de compartir con la imagen (se elige WhatsApp). Computadora: copia la imagen y abre el chat para pegarla. */
async function compartirFactura(){
  const ov = document.getElementById('ovFactura'), msg = ov.querySelector('#facMsg');
  if(!_factura) return;
  if(!_factura.blob && _factura.listo) await _factura.listo;   // espera si la imagen aún se está generando
  if(!_factura.blob) return;
  const file = new File([_factura.blob], _factura.archivo, {type:'image/png'});
  const mostrar = html => { msg.innerHTML = html; msg.hidden = false; };
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file]}); return; }
    catch(e){ if(e && e.name === 'AbortError') return; }
  }
  let copiada = false;
  try{ await navigator.clipboard.write([new ClipboardItem({'image/png': _factura.blob})]); copiada = true; }catch(e){}
  const t = String(_factura.d.tel||'').replace(/[^\d]/g,''); const num = t.length === 8 ? '504'+t : t;
  if(num) window.open('https://wa.me/' + num, '_blank', 'noopener');
  if(copiada) mostrar(`✅ Imagen copiada. ${num ? 'Se abrió el chat de WhatsApp: pégala con <b>Ctrl + V</b> y envíala.' : 'Pégala en el chat con <b>Ctrl + V</b>.'}`);
  else { ov.querySelector('#facBajar').click(); mostrar(`La imagen se descargó. ${num ? 'En el chat que se abrió, toca 📎 y adjunta la imagen descargada.' : 'Adjúntala en WhatsApp con 📎.'}`); }
}

/* ---------- teléfono de Honduras (+504) ---------- */
/* "99887766", "9988-7766" o "50499887766" -> "+504 9988-7766". Otros formatos se dejan como están. */
function telLocal(t){
  const d = String(t||'').replace(/\D/g,'');
  if(d.length === 8) return d;
  if(d.length === 11 && d.startsWith('504')) return d.slice(3);
  return null;
}
function formatoTel(t){
  const n = telLocal(t);
  return n ? `+504 ${n.slice(0,4)}-${n.slice(4)}` : String(t||'').trim();
}
/* Para el formulario: muestra solo los 8 dígitos (el +504 va fijo al lado) */
function telParaForm(t){ const n = telLocal(t); return n ? `${n.slice(0,4)}-${n.slice(4)}` : String(t||''); }
/* Busca por teléfono sin importar guiones, espacios o el 504 */
function telCoincide(t, q){ const d = String(q||'').replace(/\D/g,''); return d.length >= 3 && String(t||'').replace(/\D/g,'').includes(d); }
/* Pone "+504" delante de los campos de teléfono y les da formato al escribir */
function prepararCampoTel(input){
  if(!input || input.dataset.tel) return;
  input.dataset.tel = '1';
  const caja = document.createElement('div'); caja.className = 'tel504';
  input.parentNode.insertBefore(caja, input);
  caja.innerHTML = '<span>🇭🇳 +504</span>'; caja.appendChild(input);
  input.placeholder = '9988-7766'; input.inputMode = 'tel'; input.maxLength = 20;
  input.addEventListener('blur', () => { input.value = telParaForm(input.value); });
}

/* ---------- WhatsApp ---------- */
function linkWhatsApp(tel, texto){
  const t = String(tel||'').replace(/[^\d]/g,'');
  if(!t) return '';
  const num = t.length === 8 ? '504'+t : t;   // números de Honduras sin código de país
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

/* ---------- ventana de abono (la misma para Préstamos y Vehículos) ---------- */
/* opciones: {titulo, resumen (html), rapidos: [[texto, monto]], montoInicial, previsualizar(monto) -> html,
              guardar(monto, fecha, nota) -> Promise<boolean>, recibo(monto, fecha) -> {tel, texto, resumen}} */
let _ab = null;
function abrirAbono(op){
  let ov = document.getElementById('ovAbonoComun');
  if(!ov){
    ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'ovAbonoComun';
    ov.innerHTML = `<div class="modal chico">
      <div class="head"><h2 id="abcTitulo"></h2><button class="small" type="button" data-cerrar aria-label="Cerrar">✕</button></div>
      <div id="abcCuerpo"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('mousedown', e=>{ if(e.target === ov) ov.classList.remove('open'); });
    ov.querySelector('[data-cerrar]').onclick = () => ov.classList.remove('open');
    document.addEventListener('keydown', e=>{ if(e.key === 'Escape') ov.classList.remove('open'); });
  }
  _ab = op;
  const hoyIso = (d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date());
  ov.querySelector('#abcTitulo').textContent = op.titulo;
  const cuerpo = ov.querySelector('#abcCuerpo');
  cuerpo.innerHTML = `
    <div class="preview" style="margin-bottom:12px">${op.resumen}</div>
    <form style="display:grid;gap:10px">
      <div><label for="abc_monto">¿Cuánto abona?</label><input id="abc_monto" type="number" min="0.01" step="any" required style="font-size:20px;font-weight:700"></div>
      <div class="ab-rapidos"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label for="abc_fecha">Fecha</label><input id="abc_fecha" type="date" required value="${hoyIso}"></div>
        <div><label for="abc_nota">Nota (opcional)</label><input id="abc_nota" placeholder="Efectivo..."></div>
      </div>
      <div class="preview" id="abc_res"></div>
      <div class="actions" style="margin-top:0">
        <button type="button" data-cancelar>Cancelar</button>
        <button type="submit" class="primary">Registrar abono</button>
      </div>
    </form>`;
  const monto = cuerpo.querySelector('#abc_monto'), res = cuerpo.querySelector('#abc_res');
  const actualizar = () => {
    const m = +monto.value;
    res.innerHTML = m > 0 ? op.previsualizar(m) : 'Escribe el monto para ver cómo queda la cuenta.';
  };
  const rap = cuerpo.querySelector('.ab-rapidos');
  for(const [t, m] of (op.rapidos||[])){
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
    b.onclick = () => { monto.value = Math.round(m*100)/100; actualizar(); };
    rap.appendChild(b);
  }
  if(op.montoInicial) monto.value = Math.round(op.montoInicial*100)/100;
  monto.addEventListener('input', actualizar);
  cuerpo.querySelector('[data-cancelar]').onclick = () => ov.classList.remove('open');
  cuerpo.querySelector('form').addEventListener('submit', async e=>{
    e.preventDefault();
    const m = +monto.value; if(!(m > 0)) return;
    const fecha = cuerpo.querySelector('#abc_fecha').value, nota = cuerpo.querySelector('#abc_nota').value.trim();
    const btn = cuerpo.querySelector('button[type=submit]'); btn.disabled = true;
    const ok = await op.guardar(m, fecha, nota);
    btn.disabled = false;
    if(ok) mostrarRecibo(op.recibo(m, fecha));
  });
  actualizar();
  ov.classList.add('open');
  monto.focus();
}
/* Después de guardar: confirmación + botón para mandar el recibo por WhatsApp */
function mostrarRecibo(r){
  const ov = document.getElementById('ovAbonoComun');
  ov.querySelector('#abcTitulo').textContent = 'Abono registrado';
  const url = linkWhatsApp(r.tel, r.texto);
  ov.querySelector('#abcCuerpo').innerHTML = `<div class="ab-ok">
      <div class="big">✅</div>
      <div>${r.resumen}</div>
      ${r.factura ? `<button type="button" class="primary" data-factura style="padding:12px;font-weight:600">🧾 Enviar recibo en imagen</button>` : ''}
      ${url ? `<a class="wa" href="${url}" target="_blank" rel="noopener">💬 Enviar recibo como texto</a>` : ''}
      <button type="button" data-listo>Listo</button>
    </div>`;
  ov.querySelector('[data-listo]').onclick = () => ov.classList.remove('open');
  const bf = ov.querySelector('[data-factura]');
  if(bf) bf.onclick = () => { ov.classList.remove('open'); enviarFactura(r.factura); };
}

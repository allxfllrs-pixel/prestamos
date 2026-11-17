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
    err.status = /clave/i.test(msg) && !/Demasiados/.test(msg) ? 401 : (r.ok ? 400 : r.status);
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
      ${url ? `<a class="wa" href="${url}" target="_blank" rel="noopener">💬 Enviar recibo por WhatsApp</a>` : ''}
      <button type="button" data-listo>Listo</button>
    </div>`;
  ov.querySelector('[data-listo]').onclick = () => ov.classList.remove('open');
}

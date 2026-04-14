const GAS_URL = 'https://script.google.com/macros/s/AKfycbzFeSqQWR2A-QKySZSc8cHFywMZiurXsbI8Bcwq93y3ZpeMhDUVToZYc1z0VbpAFZjB/exec';

const SEQ_SVG = (size=60) => `<div class="seq" style="width:${size}px;height:${size}px;margin:0 auto 12px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 525 477"><path class="arm1" fill="#00843F" transform="scale(3)" d="M56.1327 45.3386C57.1796 45.1459 59.2386 45.2108 60.3151 45.2904C70.2691 46.0263 78.9047 53.5223 83.9924 61.7624C83.3155 63.8838 78.9405 71.0942 77.4963 73.5825L60.973 102.071C54.2551 113.661 45.987 123.917 50.8099 138.109C54.1879 148.049 58.0526 149.633 65.6854 155.842L65.5965 156.227C63.789 156.982 50.0625 156.613 47.375 156.602C35.1243 156.725 22.463 156.716 12.2992 148.772C6.93375 144.637 3.44982 138.523 2.62666 131.799C2.01749 126.442 2.59586 121.016 4.32064 115.908C6.61863 109.124 10.3308 103.221 13.9016 97.0575L24.4979 78.7302L32.3044 65.1852C38.3576 54.6987 42.9633 46.904 56.1327 45.3386Z"/><path class="arm2" fill="#134484" transform="scale(3)" d="M84.4272 1.08376C84.826 1.04828 85.2258 1.02472 85.626 1.01311C94.5887 0.736294 101.24 3.63153 107.727 9.76376C110.292 12.2198 112.58 14.9488 114.552 17.9022C117.233 21.8512 119.932 26.7927 122.345 30.9835L132.903 49.2033L140.844 62.9215C144.427 69.119 147.691 74.0773 147.869 81.5123C147.983 88.0088 145.526 94.2872 141.031 98.9794C135.213 105.024 125.672 108.132 117.503 108.297C116.068 106.776 113.45 101.903 112.309 99.8728C105.996 89.2223 99.9935 78.3446 93.7027 67.6939C90.4583 62.201 86.7487 54.6523 82.7077 49.9784C75.3084 41.4205 61.6371 38.2604 51.2528 42.7764C48.7451 43.8446 46.4991 44.994 44.0566 45.9939C45.6635 41.9099 48.5194 37.6935 50.6913 33.8512C58.2633 20.4548 67.2428 3.12036 84.4272 1.08376Z"/><path class="arm3" fill="#23B4AF" transform="scale(3)" d="M151.018 81.8585C152.502 82.2357 158.002 92.5595 159.093 94.475C165.49 105.713 173.322 117.652 171.822 131.201C171.041 138.266 167.357 144.836 161.673 149.093C151.544 156.844 139.988 156.523 127.924 156.513L107.688 156.512L89.7617 156.525C85.7525 156.527 81.115 156.674 77.2044 156.163C75.0613 155.867 73.4112 155.45 71.4857 154.683C55.7171 148.398 52.0268 131.584 58.8219 117.116C59.7935 115.048 59.8723 113.583 62.7287 113.478C66.074 113.355 69.4718 113.46 72.8309 113.454L106.99 113.459C112.913 113.461 122.171 113.811 127.656 112.857C131.214 112.253 134.61 110.928 137.636 108.962C144.402 104.624 148.995 97.6051 150.262 89.6686C150.634 87.24 150.587 83.8308 151.018 81.8585Z"/></svg></div>`;

let session        = null;
let presData       = [];
let pagosData      = [];
let autData        = null;
let novedadesData  = [];
let allPrestadores = [];
let pdfBlobUrl     = null;

let viewCuit   = null;
let viewNombre = null;

const fmt  = n => (parseFloat(n)||0).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const fmtP = p => { const s=String(p||''); return s.length===6 ? s.slice(0,4)+'/'+s.slice(4) : s; };
const esc  = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $    = id => document.getElementById(id);
const spin = v  => $('spinner').classList.toggle('hidden', !v);

const debounce = (fn, delay) => { let to; return (...v) => { clearTimeout(to); to = setTimeout(() => fn(...v), delay); }; };
const renderPresDebounced = debounce(() => renderPres(), 250);
const renderAutorizadosDebounced = debounce(v => renderAutorizados(v), 250);
const filtrarPrestadoresDebounced = debounce(() => filtrarPrestadores(), 250);

async function gasGet(params) {
  const res = await fetch(GAS_URL+'?'+new URLSearchParams(params).toString(), {redirect:'follow'});
  return res.json();
}

function badge(estado) {
  const e = String(estado||'').trim().toLowerCase();
  if (e==='pagado')       return `<span class="badge badge-pagado">Pagado</span>`;
  if (e==='pendiente')    return `<span class="badge badge-pendiente">Pendiente</span>`;
  if (e.includes('nota')) return `<span class="badge badge-nc">Nota de crédito</span>`;
  return `<span class="badge badge-pendiente">${esc(estado)}</span>`;
}

function claseEstado(e) {
  const s = String(e||'').toLowerCase();
  if (s.includes('autoriz'))  return 's-autorizado';
  if (s.includes('observ')||s.includes('pendiente')||s.includes('proceso')) return 's-pendiente';
  if (s.includes('rechaz'))   return 's-rechazado';
  return 's-otro';
}

// ── LOGIN ──────────────────────────────────────────────────
function clearFieldError(fieldId) {
  $( fieldId ).classList.remove('error');
}

function showLoginError(msg) {
  const err = $('login-err');
  err.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${msg}</span>`;
  err.classList.add('visible');
  const card = $('login-card');
  card.classList.remove('shake');
  void card.offsetWidth; // reflow para reiniciar animación
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 400);
}

function hideLoginError() {
  $('login-err').classList.remove('visible');
}

function togglePass() {
  const inp = $('inp-p');
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  $('eye-icon').innerHTML = isPass
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
}

async function doLogin() {
  const u = $('inp-u').value.trim();
  const p = $('inp-p').value.trim();

  // Validación cliente
  let hasError = false;
  if (!u) { $('field-u').classList.add('error'); hasError = true; }
  if (!p) { $('field-p').classList.add('error'); hasError = true; }
  if (hasError) { showLoginError('Completá usuario y contraseña para continuar.'); return; }

  hideLoginError();
  spin(true); $('btn-login').disabled = true;
  try {
    const res = await gasGet({action:'login', u, p});
    if (res.ok) {
      session = {cuit:res.cuit, nombre:res.nombre, token:res.token, isAdmin:!!res.isAdmin, loginAt:Date.now()};
      localStorage.setItem('ps_session', JSON.stringify(session));
      viewCuit   = session.cuit;
      viewNombre = session.nombre;
      mostrarPortal();
      await Promise.all([cargarDatos(), cargarNovedades(), cargarAutorizados()]);
      if (session.isAdmin) await cargarPrestadores();
    } else {
      $('field-u').classList.add('error');
      $('field-p').classList.add('error');
      showLoginError(res.error || 'Usuario o contraseña incorrectos.');
    }
  } catch(e) {
    showLoginError('No se pudo conectar. Intentá de nuevo.');
  }
  spin(false); $('btn-login').disabled = false;
}

function doLogout() {
  session = null; presData = []; pagosData = []; autData = null;
  novedadesData = []; allPrestadores = [];
  viewCuit = null; viewNombre = null;
  if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); pdfBlobUrl = null; }
  localStorage.removeItem('ps_session');
  $('s-portal').classList.remove('active');
  $('s-login').classList.add('active');
  $('inp-u').value = '';
  $('inp-p').value = '';
  // Resetear tipo contraseña y estado visual
  $('inp-p').type = 'password';
  $('eye-icon').innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  $('field-u').classList.remove('error','ok');
  $('field-p').classList.remove('error','ok');
  hideLoginError();
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('.tab').classList.add('active');
  $('panel-pres').classList.add('active');
  $('admin-banner').classList.add('hidden');
}

function mostrarPortal() {
  $('s-login').classList.remove('active');
  $('s-portal').classList.add('active');
  const ini = session.nombre.replace(/INTEGRA\s*-\s*/i,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  $('av').textContent        = ini || 'P';
  $('tb-nombre').textContent = session.nombre;
  $('tb-cuit').textContent   = 'CUIT ' + session.cuit;
  if (session.isAdmin) {
    $('av').classList.add('admin');
    $('tab-admin').classList.remove('hidden');
    $('nov-form-sidebar').classList.remove('hidden');
  } else {
    $('av').classList.remove('admin');
    $('tab-admin').classList.add('hidden');
    $('nov-form-sidebar').classList.add('hidden');
  }
}

async function cargarDatos() {
  spin(true);
  try {
    const res = await gasGet({action:'data', cuit: viewCuit, t: session.token});
    if (res.ok) {
      presData  = res.presentaciones || [];
      pagosData = res.pagos          || [];
      calcularMetricas();
      poblarPeriodos();
      renderPres();
    } else { alert('Error al cargar datos: ' + (res.error||'desconocido')); }
  } catch(e) { alert('Error de conexión al cargar datos.'); }
  spin(false);
}

// ── TABS ───────────────────────────────────────────────────
function swTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  $('panel-'+name).classList.add('active');
  if (name === 'aut' && autData === null) cargarAutorizados();
}

// ── MÉTRICAS ──────────────────────────────────────────────
function calcularMetricas() {
  const totalPresM = presData.reduce((s,r)=>s+(parseFloat(r.monto)||0), 0);
  const cantPres   = presData.length;
  const cantPag    = presData.filter(r=>String(r.estado).toLowerCase()==='pagado').length;
  const cantPend   = presData.filter(r=>String(r.estado).toLowerCase()==='pendiente').length;
  const cantNC     = presData.filter(r=>String(r.estadoOS||'').toUpperCase().includes('NOTA')).length;

  const totalPagM  = pagosData.reduce((s,r)=>s+(parseFloat(r.impSub)||0), 0);

  // Monto de notas de crédito (se descuenta del pendiente, no se cobran)
  const totalNCM   = presData
    .filter(r => String(r.estado).toLowerCase().includes('nota'))
    .reduce((s,r) => s+(parseFloat(r.monto)||0), 0);

  const totalPendM = totalPresM - totalPagM - totalNCM;

  $('m-pres-total').textContent = fmt(totalPresM);
  $('m-pres-cant').textContent  = cantPres + ' factura' + (cantPres!==1?'s':'');
  $('m-pag-total').textContent  = fmt(totalPagM);
  $('m-pag-cant').textContent   = cantPag + ' factura' + (cantPag!==1?'s':'')+' pagada'+(cantPag!==1?'s':'');
  $('m-pend-total').textContent = fmt(Math.max(0, totalPendM));
  $('m-pend-cant').textContent  = cantPend + ' factura' + (cantPend!==1?'s':'')+' pendiente'+(cantPend!==1?'s':'');
  $('m-cant-pres').textContent  = cantPres;
  $('m-nc').textContent         = cantNC;
}

function poblarPeriodos() {
  const sel  = $('f-periodo');
  const pers = [...new Set(presData.map(r=>r.periodo))].sort().reverse();
  sel.innerHTML = '<option value="">Todos los períodos</option>';
  pers.forEach(p => { const o=document.createElement('option'); o.value=p; o.textContent=fmtP(p); sel.appendChild(o); });
}

function renderPres() {
  const per = $('f-periodo').value;
  const est = $('f-estado').value;
  const q   = $('f-q').value.toLowerCase();
  let rows  = presData;
  if (per) rows = rows.filter(r => r.periodo === per);
  if (est) rows = rows.filter(r => String(r.estado).toLowerCase() === est.toLowerCase());
  if (q)   rows = rows.filter(r => String(r.afiliado).toLowerCase().includes(q) || String(r.cuil).includes(q));

  const tb = $('tbody-pres');
  if (!rows.length) { tb.innerHTML='<tr><td colspan="7" class="no-rows">Sin resultados para los filtros seleccionados</td></tr>'; return; }
  tb.innerHTML = rows.map(r => `<tr>
    <td><div class="aff-name">${esc(r.afiliado)||'—'}</div><div class="aff-cuil">${esc(r.cuil)}</div></td>
    <td>${esc(r.os)||'—'}</td>
    <td>${fmtP(r.periPrest)}</td>
    <td>${esc(r.nroComp)||'—'}</td>
    <td class="monto">${fmt(r.monto)}</td>
    <td>${badge(r.estado)}</td>
    <td>${String(r.estado).toLowerCase()==='pagado'
      ? `<button class="btn-pdf" onclick="abrirPDF(this,'${String(r.archivo).replace(/'/g,"\\'")}')">Ver comprobante</button>`
      : '<span style="color:var(--hint);font-size:12px">—</span>'
    }</td>
  </tr>`).join('');
}

// ── LEGAJOS AUTORIZADOS ───────────────────────────────────
const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function getField(r, ...keys) {
  for (const k of keys) {
    if (r[k] !== undefined && String(r[k]).trim() !== '') return r[k];
  }
  return '';
}

function toMonthNum(val) {
  if (!val && val !== 0) return null;
  const upper = String(val).trim().toUpperCase();
  const idx = MESES.indexOf(upper);
  if (idx >= 0) return idx + 1;
  const n = parseInt(val);
  if (n >= 1 && n <= 12) return n;
  const d = val instanceof Date ? val : new Date(val);
  if (!isNaN(d.getTime())) return d.getMonth() + 1;
  return null;
}

function toMonthName(val) {
  const n = toMonthNum(val);
  return n ? MESES[n - 1] : '';
}

async function cargarAutorizados() {
  $('aut-content').innerHTML = `<div class="auth-loading">${SEQ_SVG()}Cargando legajos autorizados…</div>`;
  try {
    const res = await gasGet({action:'autorizados', cuit: viewCuit, t: session.token});
    if (res.ok) {
      autData = res.autorizados || [];
      // Render the shell once (input + result containers) then fill results
      $('aut-content').innerHTML = `
        <input type="text" class="auth-filter" id="aut-filter" placeholder="Buscar legajo o filtrar por estado…" oninput="renderAutorizadosDebounced(this.value)">
        <div id="aut-summary"></div>
        <div id="aut-grid"></div>`;
      renderAutorizados('');
    } else {
      $('aut-content').innerHTML = `<div class="auth-empty" style="color:var(--red)">Error al cargar: ${esc(res.error||'desconocido')}</div>`;
    }
  } catch(e) {
    $('aut-content').innerHTML = `<div class="auth-empty" style="color:var(--red)">Error de conexión.</div>`;
  }
}

function renderAutorizados(q) {
  if (!autData || !autData.length) {
    if ($('aut-grid')) {
      $('aut-summary').innerHTML = '';
      $('aut-grid').innerHTML = `<div class="auth-empty">No hay legajos autorizados registrados para este prestador.</div>`;
    } else {
      $('aut-content').innerHTML = `<div class="auth-empty">No hay legajos autorizados registrados para este prestador.</div>`;
    }
    return;
  }
  const txt = (q||'').toLowerCase();
  let rows  = txt
    ? autData.filter(r => String(r['afiliado']||'').toLowerCase().includes(txt) || String(r['ESTADO']||'').toLowerCase().includes(txt))
    : autData;

  rows = [...rows].sort((a,b) => {
    const ea = String(a['ESTADO']||'').toLowerCase();
    const eb = String(b['ESTADO']||'').toLowerCase();
    const prio = e => e.includes('autoriz')?0:e.includes('observ')?2:1;
    const d = prio(ea)-prio(eb);
    return d!==0?d:String(a['afiliado']||'').localeCompare(String(b['afiliado']||''),'es');
  });

  const conteo = new Map();
  autData.forEach(r => { const e = String(r['ESTADO']||'Sin estado').trim(); conteo.set(e,(conteo.get(e)||0)+1); });
  const badgesHTML = [...conteo].map(([e,n]) => `<span class="auth-count-badge ${claseEstado(e)}">${esc(e.toUpperCase())}: ${n}</span>`).join('');

  const mesActual = new Date().getMonth() + 1; // 1-12

  const cards = rows.map(r => {
    const estado = String(r['ESTADO']||'').trim();
    const lo     = estado.toLowerCase();
    const obs    = lo.includes('observ');
    const aut    = lo.includes('autoriz');
    const cls    = claseEstado(estado);
    const modulo = r['MÓDULO']||r['MODULO']||'';
    const os     = r['Obra social']||r['OBRA SOCIAL']||'';
    const cuil   = r['NºCUIL']||r['CUIL']||'';

    const rawInicio = getField(r, 'INICIO', 'MES INICIO', 'MES DE INICIO', 'MES_INICIO', 'Inicio', 'inicio');
    const rawFin    = getField(r, 'FIN',    'MES FIN',    'MES DE FIN',    'MES_FIN',    'Fin',    'fin');
    const mesInicioNombre = toMonthName(rawInicio);
    const mesFinNombre    = toMonthName(rawFin);
    const mesFinNum       = toMonthNum(rawFin);
    const showWarning     = aut && mesFinNum !== null && mesFinNum <= mesActual;

    const fieldsHTML = `
      <div class="auth-fields">
        ${os ? `<div><div class="auth-field-label">Obra social</div><div class="auth-field-value">${esc(os)}</div></div>` : ''}
        ${modulo ? `<div><div class="auth-field-label">Módulo</div><div class="auth-field-value">${esc(modulo)}</div></div>` : ''}
        ${mesInicioNombre ? `<div><div class="auth-field-label">Mes inicio</div><div class="auth-field-value">${esc(mesInicioNombre)}</div></div>` : ''}
        ${mesFinNombre ? `<div><div class="auth-field-label">Mes fin</div><div class="auth-field-value">${esc(mesFinNombre)}</div></div>` : ''}
      </div>
      ${aut ? `<div class="auth-bono">📋 En caso de emisión de bonos, solicitarlo en la sucursal.</div>` : ''}
      ${showWarning ? `<div class="auth-warning">⚠️ Comunicarse con sucursal para revisar autorización</div>` : ''}`;

    const bodyHTML = obs
      ? `<div class="auth-obs-wrap"><div class="auth-obs-blur">${fieldsHTML}</div><div class="auth-obs-overlay"><span class="auth-obs-icon">🔒</span><span class="auth-obs-label">Consultar con sucursal el motivo de observación</span></div></div>`
      : fieldsHTML;

    return `<div class="auth-card">
      <div class="auth-card-top">
        <div>
          <div class="auth-afiliado">${esc(r['afiliado']||'—')}</div>
          ${cuil ? `<div class="auth-cuil">CUIL ${esc(cuil)}</div>` : ''}
        </div>
        <span class="status-badge ${cls}"><span class="status-dot"></span>${esc(estado.toUpperCase()||'—')}</span>
      </div>
      <div class="auth-divider"></div>
      ${bodyHTML}
    </div>`;
  }).join('');

  $('aut-summary').innerHTML = `
    <div class="auth-summary">
      <div class="auth-summary-txt"><strong>${autData.length}</strong> legajo${autData.length!==1?'s':''} · mostrando ${rows.length}</div>
      <div class="auth-badges">${badgesHTML}</div>
    </div>`;
  $('aut-grid').innerHTML = cards || `<div class="auth-empty">Sin resultados para "${esc(q)}"</div>`;
}

// ── PDF VIEWER ────────────────────────────────────────────
const isMobile = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth <= 700;

async function abrirPDF(btn, nombre) {
  btn.disabled = true; btn.textContent = 'Cargando…';
  try {
    const res = await gasGet({action:'pdf', nombre, cuit: viewCuit, t: session.token});
    if (res.ok && res.data) {
      const bytes = Uint8Array.from(atob(res.data), c => c.charCodeAt(0));
      const blob  = new Blob([bytes], {type:'application/pdf'});
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      pdfBlobUrl = URL.createObjectURL(blob);
      const dlName = res.nombre || nombre+'.pdf';
      $('btn-dl').href = pdfBlobUrl;
      $('btn-dl').setAttribute('download', dlName);
      if (isMobile()) {
        // En móvil: abrir en nueva pestaña (más compatible con iOS Safari)
        window.open(pdfBlobUrl, '_blank');
      } else {
        $('pdf-title').textContent = dlName;
        $('pdf-frame').classList.add('hidden');
        $('pdf-loading').style.display = 'flex';
        $('pdf-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        $('pdf-frame').src = pdfBlobUrl;
        $('pdf-loading').style.display = 'none';
        $('pdf-frame').classList.remove('hidden');
      }
    } else {
      alert('No se encontró el comprobante: ' + (res.error || nombre));
    }
  } catch(e) { alert('Error de conexión al buscar el comprobante.'); }
  btn.disabled = false; btn.textContent = 'Ver comprobante';
}

function cerrarPDF(e) {
  if (e && e.target !== $('pdf-overlay')) return;
  $('pdf-overlay').classList.remove('open');
  $('pdf-frame').src = '';
  $('pdf-frame').classList.add('hidden');
  document.body.style.overflow = '';
}

// ── NOVEDADES ─────────────────────────────────────────────
async function cargarNovedades() {
  try {
    const res = await gasGet({action:'novedades', t: session.token});
    if (res.ok) {
      novedadesData = res.novedades || [];
      renderNovedadesSidebar();
      if (session && session.isAdmin) renderNovedadesAdmin();
    }
  } catch(e) {
    $('novedades-sidebar').innerHTML = '<div class="novedad-empty">Error al cargar novedades.</div>';
  }
}

function renderNovedadesSidebar() {
  const el = $('novedades-sidebar');
  if (!novedadesData.length) {
    el.innerHTML = '<div class="novedad-empty">Sin novedades por el momento.</div>';
    return;
  }
  el.innerHTML = novedadesData.map(n => `
    <div class="novedad-card">
      <div class="novedad-header">
        <div class="novedad-titulo">${esc(n.titulo)}</div>
        <div style="display:flex;align-items:flex-start;gap:4px;flex-shrink:0;">
          ${session && session.isAdmin ? `<button class="btn-del-nov" onclick="eliminarNovedad('${esc(n.id)}')" title="Eliminar">✕</button>` : ''}
        </div>
      </div>
      <div class="novedad-fecha">${esc(n.fecha)}</div>
      ${n.cuerpo ? `<div class="novedad-cuerpo" style="margin-top:5px">${esc(n.cuerpo)}</div>` : ''}
    </div>`).join('');
}

function renderNovedadesAdmin() {
  const el = $('admin-novedades-list');
  if (!novedadesData.length) {
    el.innerHTML = '<div class="admin-list-empty">No hay novedades publicadas.</div>';
    return;
  }
  el.innerHTML = novedadesData.map(n => `
    <div class="admin-nov-card">
      <div class="admin-nov-body">
        <div class="admin-nov-titulo">${esc(n.titulo)}</div>
        <div class="admin-nov-fecha">${esc(n.fecha)}</div>
        ${n.cuerpo ? `<div class="admin-nov-cuerpo">${esc(n.cuerpo)}</div>` : ''}
      </div>
      <button class="btn-del-nov2" onclick="eliminarNovedad('${esc(n.id)}')">Eliminar</button>
    </div>`).join('');
}

async function addNovedad(src) {
  const tituloId = src==='s' ? 'nov-titulo-s' : 'nov-titulo-a';
  const cuerpoId = src==='s' ? 'nov-cuerpo-s' : 'nov-cuerpo-a';
  const btnId    = src==='s' ? 'btn-add-nov-s' : 'btn-add-nov-a';
  const titulo   = $(tituloId).value.trim();
  const cuerpo   = $(cuerpoId).value.trim();
  if (!titulo) { alert('El título es requerido.'); return; }
  $(btnId).disabled = true;
  try {
    const res = await gasGet({action:'setNovedad', titulo, cuerpo, t: session.token});
    if (res.ok) {
      $(tituloId).value = '';
      $(cuerpoId).value = '';
      await cargarNovedades();
    } else { alert('Error: ' + (res.error||'desconocido')); }
  } catch(e) { alert('Error de conexión.'); }
  $(btnId).disabled = false;
}

async function eliminarNovedad(id) {
  if (!confirm('¿Eliminar esta novedad?')) return;
  try {
    const res = await gasGet({action:'delNovedad', id, t: session.token});
    if (res.ok) { await cargarNovedades(); }
    else { alert('Error: ' + (res.error||'desconocido')); }
  } catch(e) { alert('Error de conexión.'); }
}

// ── ADMIN: PRESTADORES ────────────────────────────────────
async function cargarPrestadores() {
  try {
    const res = await gasGet({action:'prestadores', t: session.token});
    if (res.ok) {
      allPrestadores = res.prestadores || [];
      renderPrestadores(allPrestadores);
    } else {
      $('admin-prestadores-list').innerHTML = `<div class="admin-list-empty" style="color:var(--red)">${esc(res.error||'Error')}</div>`;
    }
  } catch(e) {
    $('admin-prestadores-list').innerHTML = '<div class="admin-list-empty" style="color:var(--red)">Error de conexión.</div>';
  }
}

function filtrarPrestadores() {
  const q = $('admin-search').value.toLowerCase();
  renderPrestadores(q ? allPrestadores.filter(p => p.nombre.toLowerCase().includes(q) || p.cuit.includes(q)) : allPrestadores);
}

function renderPrestadores(lista) {
  const el = $('admin-prestadores-list');
  if (!lista.length) { el.innerHTML = '<div class="admin-list-empty">Sin resultados.</div>'; return; }
  el.innerHTML = lista.map(p => `
    <div class="prestador-row">
      <div class="prestador-info">
        <div class="prestador-nombre">${esc(p.nombre)}</div>
        <div class="prestador-cuit">CUIT ${esc(p.cuit)}</div>
      </div>
      <button class="btn-ver" onclick="adminVerPrestador('${esc(p.cuit)}','${esc(p.nombre)}')">Ver datos</button>
    </div>`).join('');
}

async function adminVerPrestador(cuit, nombre) {
  viewCuit   = cuit;
  viewNombre = nombre;
  autData    = null;
  presData   = [];
  pagosData  = [];
  $('f-periodo').innerHTML = '<option value="">Todos los períodos</option>';
  $('f-estado').value = '';
  $('f-q').value = '';
  $('admin-banner-txt').textContent = 'Viendo: ' + nombre + ' (CUIT ' + cuit + ')';
  $('admin-banner').classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelector('.tab').classList.add('active');
  $('panel-pres').classList.add('active');
  await Promise.all([cargarDatos(), cargarAutorizados()]);
}

function volverAdmin() {
  viewCuit   = session.cuit;
  viewNombre = session.nombre;
  autData    = null; presData = []; pagosData = [];
  $('admin-banner').classList.add('hidden');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  $('tab-admin').classList.add('active');
  $('panel-admin').classList.add('active');
}

// Enter en login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && $('s-login').classList.contains('active')) doLogin();
});

// ── Restaurar sesión al recargar ───────────────────────────
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
(async function initSession() {
  const stored = localStorage.getItem('ps_session');
  if (!stored) return;
  try {
    const s = JSON.parse(stored);
    if (!s || !s.token || !s.cuit) return;
    if (!s.loginAt || (Date.now() - s.loginAt) > SESSION_TTL_MS) {
      localStorage.removeItem('ps_session');
      return;
    }
    session    = s;
    viewCuit   = s.cuit;
    viewNombre = s.nombre;
    mostrarPortal();
    spin(true);
    await Promise.all([cargarDatos(), cargarNovedades(), cargarAutorizados()]);
    if (session.isAdmin) await cargarPrestadores();
    spin(false);
  } catch(e) {
    localStorage.removeItem('ps_session');
  }
})();
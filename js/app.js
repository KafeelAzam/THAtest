/* =====================================================================
   THE HORIZON ACADEMY — FEES MANAGEMENT SYSTEM
   Powered by ANASH · developed by Kafeel Azam
   Data is stored locally in this browser (localStorage).
   ===================================================================== */

const LS_KEYS = { programs:'horizon_programs', students:'horizon_students', payments:'horizon_payments', settings:'horizon_settings', expenses:'horizon_expenses', trash:'horizon_trash' };

const DEFAULT_PROGRAMS = [
  {id:'9-sci',   category:'School',       name:'9th — Science',                 fee:2500, admissionFee:3000},
  {id:'9-cs',    category:'School',       name:'9th — Computer Science',        fee:2500, admissionFee:3000},
  {id:'10-sci',  category:'School',       name:'10th — Science',                fee:2800, admissionFee:3000},
  {id:'10-cs',   category:'School',       name:'10th — Computer Science',       fee:2800, admissionFee:3000},
  {id:'fy-med',  category:'Intermediate', name:'1st Year — Medical',            fee:3500, admissionFee:4000},
  {id:'fy-pe',   category:'Intermediate', name:'1st Year — Pre-Engineering',    fee:3500, admissionFee:4000},
  {id:'fy-cs',   category:'Intermediate', name:'1st Year — Computer Science',   fee:3500, admissionFee:4000},
  {id:'fy-com',  category:'Intermediate', name:'1st Year — Commerce',           fee:3200, admissionFee:4000},
  {id:'sy-med',  category:'Intermediate', name:'2nd Year — Medical',            fee:3500, admissionFee:4000},
  {id:'sy-pe',   category:'Intermediate', name:'2nd Year — Pre-Engineering',    fee:3500, admissionFee:4000},
  {id:'sy-cs',   category:'Intermediate', name:'2nd Year — Computer Science',   fee:3500, admissionFee:4000},
  {id:'sy-com',  category:'Intermediate', name:'2nd Year — Commerce',           fee:3200, admissionFee:4000},
  {id:'comp-course', category:'Skills',   name:'Computer Courses',              fee:2000, admissionFee:1500},
  {id:'eng-lang',    category:'Skills',   name:'English Language',              fee:1800, admissionFee:1500},
];
const DEFAULT_SETTINGS = {
  receiptSeq: 1000, studentSeq: 1,
  pinEnabled:false, pinHash:null,
  dueDay:10, lateFeePerDay:0, lateFeeCap:0,
  centreAddress:'', centrePhone:'', receiptFooterNote:'Thank you. Please keep this receipt for your records.'
};

/* ---------- Storage layer ----------
   This build talks to a real backend: a small Node.js/Express server
   backed by a SQLite database (see server.js). Every device that opens
   this page while pointed at the same running server reads and writes
   the SAME database, live — that's the actual multi-device/staff sync. */
let SERVER_CONNECTED = false;

/* API_BASE lets this frontend talk to the PHP backend whether it's
   served from the same folder (leave as '', the default — works whether
   this project sits at htdocs root or in a subfolder like
   htdocs/horizon-academy-app/, since the path below has no leading
   slash) or a different host entirely (set window.API_BASE =
   'http://localhost/some-other-path' before this script loads). The
   PHP backend sends permissive CORS headers, so a cross-origin
   API_BASE works out of the box too. */
const API_BASE = window.API_BASE || '';

let programs = [], students = [], payments = [], expenses = [];
let settings = Object.assign({}, DEFAULT_SETTINGS);
let trash = {students:[], payments:[], expenses:[]};

async function loadAll(){
  const res = await fetch(API_BASE + 'api/state.php');
  if(!res.ok) throw new Error('Server responded with ' + res.status);
  const data = await res.json();
  programs = (data.programs && data.programs.length) ? data.programs : DEFAULT_PROGRAMS;
  students = data.students || [];
  payments = data.payments || [];
  expenses = data.expenses || [];
  settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
  trash = data.trash || {students:[], payments:[], expenses:[]};
  students.forEach(s=>{ if(!s.studentCode) s.studentCode = nextStudentCode(); });
  SERVER_CONNECTED = true;
}
async function persistAll(){
  try{
    const res = await fetch(API_BASE + 'api/state.php', {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ programs, students, payments, expenses, settings, trash }),
    });
    if(!res.ok) throw new Error('Server responded with ' + res.status);
    SERVER_CONNECTED = true;
    const dot = document.getElementById('syncStatus'); if(dot) dot.textContent = 'connected to server';
    return true;
  }catch(e){
    SERVER_CONNECTED = false;
    const dot = document.getElementById('syncStatus'); if(dot) dot.textContent = 'offline — changes not saved';
    showToast('Could not save — check that the server is running and your connection, then try again.', null);
    return false;
  }
}
function nextStudentCode(){ return 'HA-' + String(settings.studentSeq++).padStart(4,'0'); }


function uid(){ return 'id_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function fmtMoney(n){ return 'Rs ' + Math.round(n||0).toLocaleString('en-PK'); }
function fmtDate(d){ if(!d) return '—'; const dt = new Date(d); if(isNaN(dt)) return '—'; return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtDateTime(d){ const dt = new Date(d); if(isNaN(dt)) return '—'; return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }
function programById(id){ return programs.find(p=>p.id===id); }
function studentById(id){ return students.find(s=>s.id===id); }
function catTagClass(cat){ return cat==='School' ? 'tag-school' : cat==='Intermediate' ? 'tag-inter' : 'tag-skills'; }
function pad2(n){ return String(n).padStart(2,'0'); }
function isoDate(d){ return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }

/* ---------- Dues, discount, late fee, admission installments ---------- */
function netMonthly(student){ return Math.max((student.monthlyFee||0) - (student.discount||0), 0); }
function monthsElapsed(admissionDateStr){
  const adm = new Date(admissionDateStr); const now = new Date();
  if(isNaN(adm)) return 0;
  return Math.max((now.getFullYear()-adm.getFullYear())*12 + (now.getMonth()-adm.getMonth()) + 1, 0);
}
function monthlyPaidTotal(studentId){
  return payments.filter(p=>p.studentId===studentId && p.purpose==='Monthly Fee').reduce((s,p)=>s+Number(p.amount||0),0);
}
function studentBaseDue(student){
  const expected = monthsElapsed(student.admissionDate) * netMonthly(student);
  return Math.round(expected - monthlyPaidTotal(student.id));
}
function lateFeeInfo(student){
  const perDay = Number(settings.lateFeePerDay)||0;
  if(perDay<=0) return {lateFee:0, daysLate:0, dueDate:null};
  const net = netMonthly(student);
  if(net<=0) return {lateFee:0, daysLate:0, dueDate:null};
  const adm = new Date(student.admissionDate);
  if(isNaN(adm)) return {lateFee:0, daysLate:0, dueDate:null};
  const paidTotal = monthlyPaidTotal(student.id);
  const monthsPaidFor = Math.floor(paidTotal / net);
  const totalElapsed = monthsElapsed(student.admissionDate);
  const dueDay = Math.min(Math.max(Number(settings.dueDay)||10,1),28);
  const dueMonthDate = new Date(adm.getFullYear(), adm.getMonth()+monthsPaidFor, dueDay);
  if(monthsPaidFor >= totalElapsed) return {lateFee:0, daysLate:0, dueDate:dueMonthDate};
  const today = new Date();
  if(today <= dueMonthDate) return {lateFee:0, daysLate:0, dueDate:dueMonthDate};
  const daysLate = Math.floor((today - dueMonthDate)/86400000);
  let fee = daysLate * perDay;
  const cap = Number(settings.lateFeeCap)||0;
  if(cap>0) fee = Math.min(fee, cap);
  return {lateFee: Math.round(fee), daysLate, dueDate: dueMonthDate};
}
function studentDueBreakdown(student){
  const base = studentBaseDue(student);
  const lf = base>0 ? lateFeeInfo(student) : {lateFee:0, daysLate:0, dueDate:null};
  return {base, lateFee: lf.lateFee, total: base + lf.lateFee, daysLate: lf.daysLate, dueDate: lf.dueDate};
}
function studentDue(student){ return studentDueBreakdown(student).total; }
function admissionFeeTarget(student){ return (student.admissionFee!=null) ? student.admissionFee : (programById(student.programId)?.admissionFee||0); }
function admissionFeePaidAmount(studentId){ return payments.filter(p=>p.studentId===studentId && p.purpose==='Admission Fee').reduce((s,p)=>s+Number(p.amount||0),0); }
function admissionFeeRemaining(student){ return Math.max(admissionFeeTarget(student) - admissionFeePaidAmount(student.id), 0); }

/* ---------- Phone / WhatsApp helpers ---------- */
function normalizePhone(contact){
  let digits = (contact||'').replace(/\D/g,'');
  if(!digits) return '';
  if(digits.startsWith('0')) digits = '92'+digits.slice(1);
  else if(digits.length===10 && !digits.startsWith('92')) digits = '92'+digits;
  return digits;
}
function reminderMessage(student){
  const prog = programById(student.programId);
  const b = studentDueBreakdown(student);
  let msg = `Assalam-o-Alaikum, this is a fee reminder from The Horizon Academy (Powered by ANASH) for ${student.name} (${student.studentCode}), ${prog?prog.name:''}. Outstanding dues: ${fmtMoney(b.total)}`;
  if(b.lateFee>0) msg += ` (includes late fee ${fmtMoney(b.lateFee)} for ${b.daysLate} day(s) overdue)`;
  msg += `. Kindly clear the dues at your earliest convenience. Thank you.`;
  if(settings.centrePhone) msg += ` — ${settings.centrePhone}`;
  return msg;
}
function sendWhatsApp(student){
  const phone = normalizePhone(student.contact);
  const msg = reminderMessage(student);
  if(phone){ window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank'); }
  else {
    navigator.clipboard && navigator.clipboard.writeText(msg);
    alert('No valid phone number on file — the reminder message has been copied instead, so you can paste it manually.');
  }
}

/* ---------- Toast (undo) ---------- */
let toastTimer = null;
function showToast(message, undoFn){
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = message;
  const btn = document.getElementById('toastUndoBtn');
  btn.style.display = undoFn ? 'inline-block' : 'none';
  btn.onclick = ()=>{ if(undoFn) undoFn(); t.classList.remove('show'); clearTimeout(toastTimer); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 6000);
}

/* ---------- Trash helpers ---------- */
function trashStudent(student){
  students = students.filter(s=>s.id!==student.id);
  const relatedPayments = payments.filter(p=>p.studentId===student.id);
  payments = payments.filter(p=>p.studentId!==student.id);
  trash.students.push({data:student, relatedPayments, deletedAt:new Date().toISOString()});
  persistAll();
  showToast(`${student.name} deleted.`, ()=>{
    trash.students = trash.students.filter(t=>t.data.id!==student.id);
    students.push(student); payments.push(...relatedPayments);
    persistAll(); renderStudents(); renderDashboard(); renderTrash();
  });
}
function trashPayment(payment){
  payments = payments.filter(p=>p.id!==payment.id);
  trash.payments.push({data:payment, deletedAt:new Date().toISOString()});
  persistAll();
  showToast(`Payment #${payment.receiptNo} deleted.`, ()=>{
    trash.payments = trash.payments.filter(t=>t.data.id!==payment.id);
    payments.push(payment); persistAll(); renderPayments(); renderDashboard(); renderStudents(); renderTrash();
  });
}
function trashExpense(expense){
  expenses = expenses.filter(e=>e.id!==expense.id);
  trash.expenses.push({data:expense, deletedAt:new Date().toISOString()});
  persistAll();
  showToast(`Expense deleted.`, ()=>{
    trash.expenses = trash.expenses.filter(t=>t.data.id!==expense.id);
    expenses.push(expense); persistAll(); renderExpenses(); renderDashboard(); renderTrash();
  });
}
function renderTrash(){
  const body = document.getElementById('trashBody');
  const rows = [];
  trash.students.forEach(t=>rows.push({type:'Student', label:`${t.data.name} (${t.data.studentCode||'—'})`, when:t.deletedAt, restore:()=>{
    trash.students = trash.students.filter(x=>x!==t); students.push(t.data); payments.push(...(t.relatedPayments||[])); persistAll(); renderStudents(); renderTrash(); renderDashboard();
  }, purge:()=>{ trash.students = trash.students.filter(x=>x!==t); persistAll(); renderTrash(); }}));
  trash.payments.forEach(t=>rows.push({type:'Payment', label:`Slip #${t.data.receiptNo} — ${fmtMoney(t.data.amount)}`, when:t.deletedAt, restore:()=>{
    trash.payments = trash.payments.filter(x=>x!==t); payments.push(t.data); persistAll(); renderPayments(); renderTrash(); renderDashboard(); renderStudents();
  }, purge:()=>{ trash.payments = trash.payments.filter(x=>x!==t); persistAll(); renderTrash(); }}));
  trash.expenses.forEach(t=>rows.push({type:'Expense', label:`${t.data.category} — ${fmtMoney(t.data.amount)}`, when:t.deletedAt, restore:()=>{
    trash.expenses = trash.expenses.filter(x=>x!==t); expenses.push(t.data); persistAll(); renderExpenses(); renderTrash(); renderDashboard();
  }, purge:()=>{ trash.expenses = trash.expenses.filter(x=>x!==t); persistAll(); renderTrash(); }}));
  rows.sort((a,b)=> (b.when||'').localeCompare(a.when||''));
  body.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.type}</td><td>${r.label}</td><td>${fmtDateTime(r.when)}</td><td class="row-actions"></td>`;
    const actionsTd = tr.querySelector('.row-actions');
    const restoreBtn = document.createElement('button'); restoreBtn.className='btn btn-ghost btn-sm'; restoreBtn.textContent='Restore'; restoreBtn.onclick=r.restore;
    const purgeBtn = document.createElement('button'); purgeBtn.className='btn btn-danger btn-sm'; purgeBtn.textContent='Delete Permanently'; purgeBtn.onclick=()=>{ if(confirm('Permanently delete this item? This cannot be undone.')) r.purge(); };
    actionsTd.appendChild(restoreBtn); actionsTd.appendChild(purgeBtn);
    body.appendChild(tr);
  });
  document.getElementById('trashEmpty').style.display = rows.length ? 'none' : 'block';
}
document.getElementById('btnEmptyTrash').addEventListener('click', ()=>{
  if(!confirm('Permanently delete everything in the trash? This cannot be undone.')) return;
  trash = {students:[], payments:[], expenses:[]}; persistAll(); renderTrash();
});

/* ---------- Navigation ---------- */
document.querySelectorAll('[data-page]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const page = btn.dataset.page;
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id==='page-'+page));
    if(page==='dashboard') renderDashboard();
    if(page==='students') renderStudents();
    if(page==='payments') renderPayments();
    if(page==='feestructure') renderFeeStructure();
    if(page==='expenses') renderExpenses();
    if(page==='reports') renderRecords();
    if(page==='settings'){ renderSettingsForm(); renderTrash(); }
  });
});

function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click', e=>e.target.closest('.overlay').classList.remove('show')));
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('show'); }));

/* ============================================================ DASHBOARD */
function renderDashboard(){
  document.getElementById('stTotalStudents').textContent = students.length;
  const now = new Date();
  const ym = now.getFullYear()+'-'+pad2(now.getMonth()+1);
  const monthCollected = payments.filter(p=>p.date && p.date.startsWith(ym)).reduce((s,p)=>s+Number(p.amount||0),0);
  document.getElementById('stMonthCollected').textContent = fmtMoney(monthCollected);
  const monthExpense = expenses.filter(e=>e.date && e.date.startsWith(ym)).reduce((s,e)=>s+Number(e.amount||0),0);
  document.getElementById('stMonthExpense').textContent = fmtMoney(monthExpense);
  document.getElementById('stMonthNet').textContent = fmtMoney(monthCollected - monthExpense);

  let outstanding = 0, clearCount = 0;
  students.forEach(s=>{ const d = studentDue(s); if(d>0) outstanding += d; else clearCount++; });
  document.getElementById('stOutstanding').textContent = fmtMoney(outstanding);
  document.getElementById('stClear').textContent = clearCount;

  const barsHost = document.getElementById('programBars'); barsHost.innerHTML = '';
  const maxCount = Math.max(1, ...programs.map(p=>students.filter(s=>s.programId===p.id).length));
  programs.forEach(p=>{
    const count = students.filter(s=>s.programId===p.id).length;
    if(count===0) return;
    const row = document.createElement('div'); row.className='bar-row';
    row.innerHTML = `<div class="bar-label">${p.name}</div><div class="bar-track"><div class="bar-fill" style="width:${(count/maxCount*100).toFixed(0)}%"></div></div><div class="bar-count" style="width:34px;">${count}</div>`;
    barsHost.appendChild(row);
  });
  if(!barsHost.innerHTML) barsHost.innerHTML = '<div class="empty">No students enrolled yet.</div>';

  const body = document.getElementById('recentPaymentsBody');
  const recent = [...payments].sort((a,b)=> (b.date||'').localeCompare(a.date||'') || b.receiptNo-a.receiptNo).slice(0,8);
  body.innerHTML = recent.map(p=>{
    const st = studentById(p.studentId); const prog = st ? programById(st.programId) : null;
    return `<tr><td class="mono">#${p.receiptNo}</td><td>${fmtDate(p.date)}</td><td>${st?st.name:'—'}</td><td>${prog?prog.name:'—'}</td><td>${p.purpose}</td><td style="text-align:right" class="mono">${fmtMoney(p.amount)}</td></tr>`;
  }).join('');
  document.getElementById('recentPaymentsEmpty').style.display = recent.length ? 'none' : 'block';
  renderTrendChart();
}
function renderTrendChart(){
  const host = document.getElementById('trendChart');
  if(!host) return;
  const now = new Date();
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ym: d.getFullYear()+'-'+pad2(d.getMonth()+1), label: d.toLocaleDateString('en-GB',{month:'short'})});
  }
  const data = months.map(m=>{
    const income = payments.filter(p=>p.date && p.date.startsWith(m.ym)).reduce((s,p)=>s+Number(p.amount||0),0);
    const expense = expenses.filter(e=>e.date && e.date.startsWith(m.ym)).reduce((s,e)=>s+Number(e.amount||0),0);
    return Object.assign({}, m, {income, expense});
  });
  const maxV = Math.max(1, ...data.map(d=>Math.max(d.income,d.expense)));
  const W=560, H=190, padL=6, padR=6, padT=8, padB=24;
  const chartW = W-padL-padR, chartH = H-padT-padB;
  const groupW = chartW/data.length;
  const barW = Math.min(24, groupW/3.2);
  let bars = '';
  data.forEach((d,i)=>{
    const cx = padL + groupW*i + groupW/2;
    const incH = (d.income/maxV)*chartH, expH = (d.expense/maxV)*chartH;
    bars += `<rect x="${(cx-barW-2).toFixed(1)}" y="${(padT+chartH-incH).toFixed(1)}" width="${barW.toFixed(1)}" height="${incH.toFixed(1)}" rx="2" fill="#3E7C8A"></rect>`;
    bars += `<rect x="${(cx+2).toFixed(1)}" y="${(padT+chartH-expH).toFixed(1)}" width="${barW.toFixed(1)}" height="${expH.toFixed(1)}" rx="2" fill="#B8442F"></rect>`;
    bars += `<text x="${cx.toFixed(1)}" y="${H-6}" font-size="10" text-anchor="middle" fill="#6B7280">${d.label}</text>`;
  });
  const baseline = `<line x1="${padL}" y1="${padT+chartH}" x2="${W-padR}" y2="${padT+chartH}" stroke="#E1DACB" stroke-width="1"></line>`;
  const hasAny = data.some(d=>d.income>0||d.expense>0);
  host.innerHTML = hasAny ? `
    <div style="display:flex; gap:16px; font-size:12px; color:var(--muted); margin-bottom:8px;">
      <span><span style="display:inline-block;width:9px;height:9px;background:#3E7C8A;border-radius:2px;margin-right:5px;"></span>Income</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#B8442F;border-radius:2px;margin-right:5px;"></span>Expense</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; max-width:560px; display:block;">${baseline}${bars}</svg>`
    : '<div class="empty">No income or expense recorded in the last 6 months.</div>';
}

/* ============================================================ STUDENTS */
let selectedStudentIds = new Set();
function updateBulkBar(){
  const bar = document.getElementById('bulkActionBar');
  const count = selectedStudentIds.size;
  bar.style.display = count ? 'flex' : 'none';
  document.getElementById('bulkSelectedCount').textContent = count ? `${count} selected` : '';
}
function populateProgramSelect(sel, includeAll){
  sel.innerHTML = (includeAll ? '<option value="">All programmes</option>' : '') + programs.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
}
function renderStudents(){
  populateProgramSelect(document.getElementById('studentProgramFilter'), true);
  const q = document.getElementById('studentSearch').value.trim().toLowerCase();
  const cat = document.getElementById('studentCategoryFilter').value;
  const progFilter = document.getElementById('studentProgramFilter').value;
  const dueFilter = document.getElementById('studentDueFilter').value;

  let list = students.filter(s=>{
    const prog = programById(s.programId); if(!prog) return false;
    if(q && !(s.name.toLowerCase().includes(q) || (s.contact||'').toLowerCase().includes(q) || (s.studentCode||'').toLowerCase().includes(q))) return false;
    if(cat && prog.category!==cat) return false;
    if(progFilter && s.programId!==progFilter) return false;
    const due = studentDue(s);
    if(dueFilter==='owing' && due<=0) return false;
    if(dueFilter==='clear' && due>0) return false;
    return true;
  }).sort((a,b)=>a.name.localeCompare(b.name));

  const validIds = new Set(students.map(s=>s.id));
  selectedStudentIds.forEach(id=>{ if(!validIds.has(id)) selectedStudentIds.delete(id); });

  const body = document.getElementById('studentsBody');
  body.innerHTML = list.map(s=>{
    const prog = programById(s.programId); const b = studentDueBreakdown(s); const net = netMonthly(s);
    return `<tr>
      <td><input type="checkbox" class="rowcheck" data-id="${s.id}" ${selectedStudentIds.has(s.id)?'checked':''}></td>
      <td class="mono">${s.studentCode||'—'}</td>
      <td><b>${s.name}</b>${s.father? `<div class="helper">S/O ${s.father}</div>`:''}</td>
      <td><span class="tag ${catTagClass(prog.category)}">${prog.category}</span><div class="helper">${prog.name}</div></td>
      <td>${s.contact||'—'}</td>
      <td>${fmtDate(s.admissionDate)}</td>
      <td style="text-align:right" class="mono">${fmtMoney(net)}${s.discount>0?`<div class="helper" style="text-align:right;">-${fmtMoney(s.discount)} disc.</div>`:''}</td>
      <td style="text-align:right" class="mono ${b.total>0?'due-owing':'due-clear'}">${b.total>0? fmtMoney(b.total) : 'Clear'}${b.lateFee>0?`<div class="helper" style="text-align:right;color:var(--red);">incl. late fee ${fmtMoney(b.lateFee)}</div>`:''}</td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-view="${s.id}">View</button>
        <button class="btn btn-gold btn-sm" data-collect="${s.id}">Collect</button>
        <button class="btn btn-ghost btn-sm" data-edit="${s.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${s.id}">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
  document.getElementById('studentsEmpty').style.display = list.length ? 'none' : 'block';
  document.getElementById('selectAllStudents').checked = list.length>0 && list.every(s=>selectedStudentIds.has(s.id));

  body.querySelectorAll('.rowcheck').forEach(cb=>cb.addEventListener('change', ()=>{
    if(cb.checked) selectedStudentIds.add(cb.dataset.id); else selectedStudentIds.delete(cb.dataset.id);
    document.getElementById('selectAllStudents').checked = list.length>0 && list.every(s=>selectedStudentIds.has(s.id));
    updateBulkBar();
  }));
  body.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click', ()=>openStudentView(b.dataset.view)));
  body.querySelectorAll('[data-collect]').forEach(b=>b.addEventListener('click', ()=>openPaymentModal(b.dataset.collect)));
  body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>openStudentModal(b.dataset.edit)));
  body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>{
    const s = studentById(b.dataset.del);
    if(confirm(`Delete ${s.name}? Their payment history moves to Trash and can be restored later.`)){ selectedStudentIds.delete(s.id); trashStudent(s); }
    renderStudents();
  }));
  updateBulkBar();
}
document.getElementById('selectAllStudents').addEventListener('change', (e)=>{
  const checked = e.target.checked;
  document.querySelectorAll('#studentsBody .rowcheck').forEach(cb=>{
    cb.checked = checked;
    if(checked) selectedStudentIds.add(cb.dataset.id); else selectedStudentIds.delete(cb.dataset.id);
  });
  updateBulkBar();
});
document.getElementById('btnBulkClear').addEventListener('click', ()=>{ selectedStudentIds.clear(); renderStudents(); });
document.getElementById('btnBulkDelete').addEventListener('click', ()=>{
  const ids = [...selectedStudentIds];
  if(!ids.length) return;
  if(!confirm(`Delete ${ids.length} selected student(s)? They will move to Trash and can be restored later.`)) return;
  ids.forEach(id=>{ const s = studentById(id); if(s) trashStudent(s); });
  selectedStudentIds.clear();
  renderStudents(); renderDashboard();
});
document.getElementById('btnBulkProgramme').addEventListener('click', ()=>{
  if(!selectedStudentIds.size) return;
  populateProgramSelect(document.getElementById('bulkProgTarget'), false);
  document.getElementById('bulkProgResetFee').checked = true;
  openModal('bulkProgOverlay');
});
document.getElementById('btnConfirmBulkProg').addEventListener('click', ()=>{
  const toId = document.getElementById('bulkProgTarget').value;
  const toProg = programById(toId);
  const resetFee = document.getElementById('bulkProgResetFee').checked;
  selectedStudentIds.forEach(id=>{
    const s = studentById(id); if(!s) return;
    s.programId = toId; if(resetFee) s.monthlyFee = toProg.fee;
  });
  const n = selectedStudentIds.size;
  persistAll(); closeModal('bulkProgOverlay'); selectedStudentIds.clear();
  renderStudents(); renderDashboard();
  alert(`Updated programme for ${n} student(s).`);
});
document.getElementById('btnBulkDiscount').addEventListener('click', ()=>{
  if(!selectedStudentIds.size) return;
  document.getElementById('bulkDiscountAmount').value = 0;
  document.getElementById('bulkDiscountReason').value = '';
  openModal('bulkDiscountOverlay');
});
document.getElementById('btnConfirmBulkDiscount').addEventListener('click', ()=>{
  const amt = Number(document.getElementById('bulkDiscountAmount').value)||0;
  const reason = document.getElementById('bulkDiscountReason').value.trim();
  selectedStudentIds.forEach(id=>{ const s = studentById(id); if(!s) return; s.discount = amt; s.discountReason = reason; });
  const n = selectedStudentIds.size;
  persistAll(); closeModal('bulkDiscountOverlay'); selectedStudentIds.clear();
  renderStudents(); renderDashboard();
  alert(`Discount updated for ${n} student(s).`);
});
document.getElementById('btnBulkIdCards').addEventListener('click', ()=>{
  if(!selectedStudentIds.size) return;
  printIdCards(students.filter(s=>selectedStudentIds.has(s.id)));
});

/* ---------- Promote students ---------- */
function populatePromoteSelects(){
  const from = document.getElementById('promoteFrom');
  const to = document.getElementById('promoteTo');
  from.innerHTML = programs.map(p=>{
    const count = students.filter(s=>s.programId===p.id).length;
    return `<option value="${p.id}">${p.name} (${count} student${count===1?'':'s'})</option>`;
  }).join('');
  to.innerHTML = programs.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  updatePromoteCount();
}
function updatePromoteCount(){
  const fromId = document.getElementById('promoteFrom').value;
  const count = students.filter(s=>s.programId===fromId).length;
  document.getElementById('promoteCount').textContent = `${count} student${count===1?'':'s'} currently in this programme will be moved.`;
}
document.getElementById('btnPromoteStudents').addEventListener('click', ()=>{
  if(!students.length){ alert('No students to promote yet.'); return; }
  if(programs.length<2){ alert('Add a second programme first (e.g. the next year/level) before promoting.'); return; }
  populatePromoteSelects();
  document.getElementById('promoteResetFee').checked = true;
  openModal('promoteOverlay');
});
document.getElementById('promoteFrom').addEventListener('change', updatePromoteCount);
document.getElementById('btnConfirmPromote').addEventListener('click', ()=>{
  const fromId = document.getElementById('promoteFrom').value;
  const toId = document.getElementById('promoteTo').value;
  if(fromId===toId){ alert('From and To programmes must be different.'); return; }
  const affected = students.filter(s=>s.programId===fromId);
  if(!affected.length){ alert('No students in the selected From programme.'); return; }
  const toProg = programById(toId);
  if(!confirm(`Move ${affected.length} student(s) from "${programById(fromId).name}" to "${toProg.name}"?`)) return;
  const resetFee = document.getElementById('promoteResetFee').checked;
  affected.forEach(s=>{ s.programId = toId; if(resetFee) s.monthlyFee = toProg.fee; });
  persistAll(); closeModal('promoteOverlay'); renderStudents(); renderDashboard();
  alert(`Promoted ${affected.length} student(s) to ${toProg.name}.`);
});
['studentSearch','studentCategoryFilter','studentProgramFilter','studentDueFilter'].forEach(id=>{
  document.getElementById(id).addEventListener('input', renderStudents);
  document.getElementById(id).addEventListener('change', renderStudents);
});

function setPhotoPreview(dataUrl){
  const prev = document.getElementById('studentPhotoPreview');
  document.getElementById('studentPhotoData').value = dataUrl || '';
  document.getElementById('studentPhotoInput').value = '';
  if(dataUrl){ prev.src = dataUrl; prev.style.display = 'block'; } else { prev.src = ''; prev.style.display = 'none'; }
}
document.getElementById('studentPhotoInput').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const img = new Image();
    img.onload = ()=>{
      const maxDim = 180;
      let w = img.width, h = img.height;
      if(w>h){ if(w>maxDim){ h = Math.round(h*maxDim/w); w = maxDim; } }
      else { if(h>maxDim){ w = Math.round(w*maxDim/h); h = maxDim; } }
      const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      setPhotoPreview(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});
function openStudentModal(id){
  const sel = document.getElementById('studentProgram'); populateProgramSelect(sel, false);
  document.getElementById('studentId').value = id || '';
  if(id){
    const s = studentById(id);
    document.getElementById('studentModalTitle').textContent = 'Edit Student';
    document.getElementById('studentName').value = s.name;
    document.getElementById('studentFather').value = s.father||'';
    document.getElementById('studentContact').value = s.contact||'';
    sel.value = s.programId;
    document.getElementById('studentAdmDate').value = s.admissionDate||'';
    document.getElementById('studentFee').value = s.monthlyFee;
    document.getElementById('studentDiscount').value = s.discount||0;
    document.getElementById('studentDiscountReason').value = s.discountReason||'';
    document.getElementById('studentAdmissionFee').value = admissionFeeTarget(s);
    document.getElementById('studentCode').value = s.studentCode||'';
    setPhotoPreview(s.photo||'');
  } else {
    document.getElementById('studentModalTitle').textContent = 'Add Student';
    document.getElementById('studentCode').value = 'HA-' + String(settings.studentSeq).padStart(4,'0') + ' (assigned on save)';
    document.getElementById('studentName').value = '';
    document.getElementById('studentFather').value = '';
    document.getElementById('studentContact').value = '';
    sel.value = programs[0]?.id || '';
    document.getElementById('studentAdmDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('studentFee').value = programById(sel.value)?.fee || '';
    document.getElementById('studentDiscount').value = 0;
    document.getElementById('studentDiscountReason').value = '';
    document.getElementById('studentAdmissionFee').value = programById(sel.value)?.admissionFee || '';
    setPhotoPreview('');
  }
  openModal('studentOverlay');
}
document.getElementById('studentProgram').addEventListener('change', e=>{
  if(!document.getElementById('studentId').value){
    document.getElementById('studentFee').value = programById(e.target.value)?.fee || 0;
    document.getElementById('studentAdmissionFee').value = programById(e.target.value)?.admissionFee || 0;
  }
});
document.getElementById('btnAddStudent').addEventListener('click', ()=>openStudentModal(null));

document.getElementById('btnSaveStudent').addEventListener('click', ()=>{
  const name = document.getElementById('studentName').value.trim();
  if(!name){ alert('Please enter the student name.'); return; }
  const id = document.getElementById('studentId').value;
  const data = {
    name,
    father: document.getElementById('studentFather').value.trim(),
    contact: document.getElementById('studentContact').value.trim(),
    photo: document.getElementById('studentPhotoData').value || '',
    programId: document.getElementById('studentProgram').value,
    admissionDate: document.getElementById('studentAdmDate').value,
    monthlyFee: Number(document.getElementById('studentFee').value) || 0,
    discount: Number(document.getElementById('studentDiscount').value) || 0,
    discountReason: document.getElementById('studentDiscountReason').value.trim(),
    admissionFee: Number(document.getElementById('studentAdmissionFee').value) || 0,
  };
  if(id){ Object.assign(studentById(id), data); } else { students.push({id: uid(), studentCode: nextStudentCode(), ...data}); }
  persistAll(); closeModal('studentOverlay'); renderStudents(); renderDashboard();
});

/* ============================================================ PAYMENTS + SLIP */
function populateStudentSelect(sel, preselectId){
  sel.innerHTML = students.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{
    const prog = programById(s.programId);
    return `<option value="${s.id}">${s.name} (${s.studentCode||'—'}) — ${prog?prog.name:''}</option>`;
  }).join('');
  if(preselectId) sel.value = preselectId;
}
function updateDuesBanner(){
  const sid = document.getElementById('paySelectStudent').value;
  const banner = document.getElementById('payDuesBanner');
  const st = studentById(sid);
  if(!st){ banner.style.display='none'; return; }
  const b = studentDueBreakdown(st);
  const admRemaining = admissionFeeRemaining(st);
  banner.style.display = 'flex';
  banner.innerHTML = `<span>Monthly dues: <b class="${b.total>0?'due-owing':'due-clear'}">${b.total>0?fmtMoney(b.total):'Clear'}</b></span>` +
    (b.lateFee>0 ? `<span>Late fee: <b class="due-owing">${fmtMoney(b.lateFee)}</b> (${b.daysLate}d)</span>` : '') +
    (st.discount>0 ? `<span>Discount: <b>${fmtMoney(st.discount)}/mo</b></span>` : '') +
    (admRemaining>0 ? `<span>Admission fee remaining: <b class="due-owing">${fmtMoney(admRemaining)}</b></span>` : '');
}
function suggestedAmount(st){
  if(!st) return '';
  const purpose = document.getElementById('payPurpose').value;
  if(purpose==='Admission Fee') return admissionFeeRemaining(st) || '';
  if(purpose==='Monthly Fee') return Math.max(studentDue(st),0) || netMonthly(st);
  return '';
}
function openPaymentModal(studentId){
  populateStudentSelect(document.getElementById('paySelectStudent'), studentId);
  document.getElementById('payDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('payPurpose').value = 'Monthly Fee';
  document.getElementById('payMode').value = 'Cash';
  document.getElementById('payNote').value = '';
  updateDuesBanner();
  const st = studentById(document.getElementById('paySelectStudent').value);
  document.getElementById('payAmount').value = suggestedAmount(st);
  openModal('paymentOverlay');
}
document.getElementById('paySelectStudent').addEventListener('change', ()=>{
  updateDuesBanner();
  document.getElementById('payAmount').value = suggestedAmount(studentById(document.getElementById('paySelectStudent').value));
});
document.getElementById('payPurpose').addEventListener('change', ()=>{
  document.getElementById('payAmount').value = suggestedAmount(studentById(document.getElementById('paySelectStudent').value));
});
document.getElementById('btnNewPayment').addEventListener('click', ()=> students.length ? openPaymentModal(null) : alert('Add a student first.'));
document.getElementById('btnQuickCollect').addEventListener('click', ()=>{
  if(students.length) openPaymentModal(null);
  else { document.querySelector('[data-page="students"]').click(); alert('Add a student first, then collect a fee.'); }
});

document.getElementById('btnSavePayment').addEventListener('click', ()=>{
  const studentId = document.getElementById('paySelectStudent').value;
  const amount = Number(document.getElementById('payAmount').value);
  if(!studentId){ alert('Select a student.'); return; }
  if(!amount || amount<=0){ alert('Enter a valid amount.'); return; }
  const receiptNo = settings.receiptSeq++;
  const payment = {
    id: uid(), receiptNo, studentId,
    date: document.getElementById('payDate').value || new Date().toISOString().slice(0,10),
    amount, purpose: document.getElementById('payPurpose').value,
    mode: document.getElementById('payMode').value,
    note: document.getElementById('payNote').value.trim(),
  };
  payments.push(payment); persistAll(); closeModal('paymentOverlay');
  printSlip(payment);
  renderDashboard(); renderStudents(); renderPayments();
});

function slipHeaderHTML(){
  return `<div class="slip-head"><div class="sh-title">The Horizon Academy</div><div class="sh-sub">Powered by ANASH</div>
    ${(settings.centreAddress||settings.centrePhone) ? `<div class="sh-contact">${settings.centreAddress||''}${settings.centreAddress&&settings.centrePhone?' · ':''}${settings.centrePhone||''}</div>` : ''}
  </div>`;
}
function buildSlipCopyHTML(payment, st, prog, copyLabel){
  const gross = st ? st.monthlyFee : 0;
  const discount = st ? (st.discount||0) : 0;
  const net = st ? netMonthly(st) : 0;
  const showDiscount = payment.purpose==='Monthly Fee' && discount>0;
  return `
    <div class="slip-copy">
      <div class="slip-copy-label">${copyLabel}</div>
      ${slipHeaderHTML()}
      <div class="slip-row"><span>Slip No.</span><b>#${payment.receiptNo}</b></div>
      <div class="slip-row"><span>Date</span><b>${fmtDate(payment.date)}</b></div>
      <div class="slip-row"><span>Student</span><b>${st?st.name:'—'}</b></div>
      <div class="slip-row slip-sub"><span>Student ID</span><span>${st&&st.studentCode?st.studentCode:'—'}</span></div>
      <div class="slip-row"><span>Programme</span><b>${prog?prog.name:'—'}</b></div>
      <div class="slip-row"><span>Purpose</span><b>${payment.purpose}</b></div>
      ${showDiscount ? `
      <div class="slip-row slip-sub"><span>Monthly Fee</span><span class="slip-strike">${fmtMoney(gross)}</span></div>
      <div class="slip-row slip-sub"><span>Discount${st.discountReason? ' ('+st.discountReason+')':''}</span><span>− ${fmtMoney(discount)}</span></div>
      <div class="slip-row slip-sub"><span>Net Payable / mo</span><span>${fmtMoney(net)}</span></div>` : ''}
      <div class="slip-row"><span>Mode</span><b>${payment.mode}</b></div>
      ${payment.note ? `<div class="slip-row slip-sub"><span>Note</span><span>${payment.note}</span></div>` : ''}
      <div class="slip-amt"><span>Amount Paid</span><span>${fmtMoney(payment.amount)}</span></div>
      <div class="slip-sign"><div>Received by</div><div>Parent / Student sign</div></div>
      <div class="slip-foot">${settings.receiptFooterNote||'Thank you.'}</div>
    </div>`;
}
function printSlip(payment){
  const st = studentById(payment.studentId);
  const prog = st ? programById(st.programId) : null;
  const html = `<div class="slip-sheet">
      ${buildSlipCopyHTML(payment, st, prog, 'Student Copy')}
      <div class="slip-cut"><span>✂ cut here — office copy below</span></div>
      ${buildSlipCopyHTML(payment, st, prog, 'Office / Admin Copy')}
    </div>`;
  document.getElementById('printArea').innerHTML = html;
  setTimeout(()=>window.print(), 120);
}

function renderPayments(){
  const q = document.getElementById('paymentSearch').value.trim().toLowerCase();
  const monthFilter = document.getElementById('paymentMonthFilter').value;
  const purposeFilter = document.getElementById('paymentPurposeFilter').value;
  let list = payments.filter(p=>{
    const st = studentById(p.studentId);
    if(q && !((st?.name||'').toLowerCase().includes(q) || String(p.receiptNo).includes(q))) return false;
    if(monthFilter && !(p.date||'').startsWith(monthFilter)) return false;
    if(purposeFilter && p.purpose!==purposeFilter) return false;
    return true;
  }).sort((a,b)=> (b.date||'').localeCompare(a.date||'') || b.receiptNo-a.receiptNo);

  const body = document.getElementById('paymentsBody');
  body.innerHTML = list.map(p=>{
    const st = studentById(p.studentId); const prog = st ? programById(st.programId) : null;
    return `<tr>
      <td class="mono">#${p.receiptNo}</td><td>${fmtDate(p.date)}</td>
      <td>${st?st.name:'<em>deleted</em>'}</td><td>${prog?prog.name:'—'}</td>
      <td>${p.purpose}</td><td>${p.mode}</td>
      <td style="text-align:right" class="mono">${fmtMoney(p.amount)}</td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-reprint="${p.id}">Slip</button>
        <button class="btn btn-danger btn-sm" data-delpay="${p.id}">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
  document.getElementById('paymentsEmpty').style.display = list.length ? 'none' : 'block';
  body.querySelectorAll('[data-reprint]').forEach(b=>b.addEventListener('click', ()=>printSlip(payments.find(p=>p.id===b.dataset.reprint))));
  body.querySelectorAll('[data-delpay]').forEach(b=>b.addEventListener('click', ()=>{
    const p = payments.find(x=>x.id===b.dataset.delpay);
    if(confirm('Delete this payment record? It will move to Trash.')){ trashPayment(p); renderPayments(); }
  }));
}
['paymentSearch','paymentMonthFilter','paymentPurposeFilter'].forEach(id=>{
  document.getElementById(id).addEventListener('input', renderPayments);
  document.getElementById(id).addEventListener('change', renderPayments);
});

/* ============================================================ FEE STRUCTURE */
function renderFeeStructure(){
  const host = document.getElementById('feeStructurePanel');
  const cats = ['School','Intermediate','Skills'];
  const catLabel = {School:'School', Intermediate:'Intermediate — Pre-Medical / Pre-Engineering / CS / Commerce', Skills:'Computer Courses & English Language'};
  host.innerHTML = cats.map(cat=>{
    const rows = programs.filter(p=>p.category===cat).map(p=>`
      <div class="fee-row" style="display:flex; align-items:center; gap:14px; padding:8px 0; border-bottom:1px solid var(--line);">
        <div style="flex:1;">${p.name}</div>
        <div><label class="helper">Monthly&nbsp;</label><input type="number" min="0" data-fee="${p.id}" value="${p.fee}"></div>
        <div><label class="helper">Admission&nbsp;</label><input type="number" min="0" data-admfee="${p.id}" value="${p.admissionFee}"></div>
        <button class="btn btn-danger btn-sm" data-delprog="${p.id}" title="Delete programme">🗑</button>
      </div>`).join('');
    return `<div class="fee-cat-title">${catLabel[cat]}</div>${rows}`;
  }).join('');
  host.querySelectorAll('[data-delprog]').forEach(b=>b.addEventListener('click', ()=>{
    const p = programById(b.dataset.delprog);
    const inUse = students.some(s=>s.programId===p.id);
    if(inUse){ alert(`Can't delete "${p.name}" — students are still enrolled in it. Move them (Promote Students, or edit each) first.`); return; }
    if(!confirm(`Delete the programme "${p.name}"? This cannot be undone.`)) return;
    programs = programs.filter(x=>x.id!==p.id);
    persistAll(); renderFeeStructure();
  }));
}
document.getElementById('btnSaveFees').addEventListener('click', ()=>{
  document.querySelectorAll('[data-fee]').forEach(inp=>{ programById(inp.dataset.fee).fee = Number(inp.value)||0; });
  document.querySelectorAll('[data-admfee]').forEach(inp=>{ programById(inp.dataset.admfee).admissionFee = Number(inp.value)||0; });
  persistAll();
  alert('Fee structure saved. New students & manual edits will use these defaults.');
});
document.getElementById('btnAddProgramme').addEventListener('click', ()=>{
  document.getElementById('newProgName').value = '';
  document.getElementById('newProgCategory').value = 'School';
  document.getElementById('newProgFee').value = 2500;
  document.getElementById('newProgAdmFee').value = 3000;
  openModal('programmeOverlay');
});
document.getElementById('btnSaveProgramme').addEventListener('click', ()=>{
  const name = document.getElementById('newProgName').value.trim();
  if(!name){ alert('Enter a programme name.'); return; }
  if(programs.some(p=>p.name.toLowerCase()===name.toLowerCase())){ alert('A programme with this name already exists.'); return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const id = `custom-${slug}-${Math.random().toString(36).slice(2,6)}`;
  programs.push({
    id, name, category: document.getElementById('newProgCategory').value,
    fee: Number(document.getElementById('newProgFee').value)||0,
    admissionFee: Number(document.getElementById('newProgAdmFee').value)||0,
  });
  persistAll(); closeModal('programmeOverlay'); renderFeeStructure();
});

/* ============================================================ EXPENSES */
function renderExpenses(){
  const q = document.getElementById('expenseSearch').value.trim().toLowerCase();
  const monthFilter = document.getElementById('expenseMonthFilter').value;
  const catFilter = document.getElementById('expenseCategoryFilter').value;
  let list = expenses.filter(e=>{
    if(q && !((e.note||'').toLowerCase().includes(q))) return false;
    if(monthFilter && !(e.date||'').startsWith(monthFilter)) return false;
    if(catFilter && e.category!==catFilter) return false;
    return true;
  }).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  const body = document.getElementById('expensesBody');
  body.innerHTML = list.map(e=>`<tr>
    <td>${fmtDate(e.date)}</td><td><span class="tag tag-late" style="background:#EFEAdd;color:var(--ink-2);">${e.category}</span></td>
    <td>${e.note||'—'}</td><td style="text-align:right" class="mono">${fmtMoney(e.amount)}</td>
    <td><button class="btn btn-danger btn-sm" data-delexp="${e.id}">Delete</button></td>
  </tr>`).join('');
  document.getElementById('expensesEmpty').style.display = list.length ? 'none' : 'block';
  body.querySelectorAll('[data-delexp]').forEach(b=>b.addEventListener('click', ()=>{
    const e = expenses.find(x=>x.id===b.dataset.delexp);
    if(confirm('Delete this expense? It will move to Trash.')){ trashExpense(e); renderExpenses(); }
  }));
}
['expenseSearch','expenseMonthFilter','expenseCategoryFilter'].forEach(id=>{
  document.getElementById(id).addEventListener('input', renderExpenses);
  document.getElementById(id).addEventListener('change', renderExpenses);
});
document.getElementById('btnAddExpense').addEventListener('click', ()=>{
  document.getElementById('expenseId').value = '';
  document.getElementById('expenseModalTitle').textContent = 'Add Expense';
  document.getElementById('expenseDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseCategory').value = 'Rent';
  document.getElementById('expenseNote').value = '';
  openModal('expenseOverlay');
});
document.getElementById('btnSaveExpense').addEventListener('click', ()=>{
  const amount = Number(document.getElementById('expenseAmount').value);
  if(!amount || amount<=0){ alert('Enter a valid amount.'); return; }
  expenses.push({
    id: uid(), date: document.getElementById('expenseDate').value || new Date().toISOString().slice(0,10),
    amount, category: document.getElementById('expenseCategory').value, note: document.getElementById('expenseNote').value.trim(),
  });
  persistAll(); closeModal('expenseOverlay'); renderExpenses(); renderDashboard();
});

/* ============================================================ RECORDS & REPORTS */
let currentPeriodType = 'daily';
function isoWeekOf(d){
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(),0,4));
  const week = 1 + Math.round(((t - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay()+6)%7)) / 7);
  return t.getUTCFullYear() + '-W' + pad2(week);
}
function weekToRange(weekString){
  const [yearStr, wkStr] = weekString.split('-W');
  const year = Number(yearStr), week = Number(wkStr);
  const simple = new Date(Date.UTC(year,0,1 + (week-1)*7));
  const dow = simple.getUTCDay() || 7;
  const monday = new Date(simple); if(dow<=4) monday.setUTCDate(simple.getUTCDate()-dow+1); else monday.setUTCDate(simple.getUTCDate()+8-dow);
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate()+6);
  return {start: isoDate(monday), end: isoDate(sunday)};
}
function renderPeriodInput(){
  const host = document.getElementById('periodInputHost');
  const today = new Date();
  if(currentPeriodType==='daily'){ host.innerHTML = `<input type="date" id="periodValue" value="${isoDate(today)}">`; }
  else if(currentPeriodType==='weekly'){ host.innerHTML = `<input type="week" id="periodValue" value="${isoWeekOf(today)}">`; }
  else if(currentPeriodType==='monthly'){ host.innerHTML = `<input type="month" id="periodValue" value="${today.getFullYear()}-${pad2(today.getMonth()+1)}">`; }
  else { host.innerHTML = `<input type="number" id="periodValue" min="2015" max="2100" value="${today.getFullYear()}" style="width:100px;">`; }
  document.getElementById('periodValue').addEventListener('input', renderRecords);
  document.getElementById('periodValue').addEventListener('change', renderRecords);
}
document.querySelectorAll('.period-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.period-tab').forEach(t=>t.classList.toggle('active', t===tab));
    currentPeriodType = tab.dataset.period;
    renderPeriodInput(); renderRecords();
  });
});
function currentPeriodLabel(){
  const val = document.getElementById('periodValue')?.value || '';
  if(currentPeriodType==='daily') return `Day: ${fmtDate(val)}`;
  if(currentPeriodType==='weekly') return `Week: ${val}`;
  if(currentPeriodType==='monthly') return `Month: ${val}`;
  return `Year: ${val}`;
}
function inPeriod(dateStr){
  const val = document.getElementById('periodValue')?.value || '';
  if(!val || !dateStr) return false;
  if(currentPeriodType==='daily') return dateStr===val;
  if(currentPeriodType==='weekly'){ const {start,end} = weekToRange(val); return dateStr>=start && dateStr<=end; }
  if(currentPeriodType==='monthly') return dateStr.startsWith(val);
  return dateStr.startsWith(String(val));
}
function renderRecords(){
  if(!document.getElementById('periodValue')) renderPeriodInput();
  const periodPayments = payments.filter(p=>inPeriod(p.date)).sort((a,b)=> (b.date||'').localeCompare(a.date||'') || b.receiptNo-a.receiptNo);
  const periodExpenses = expenses.filter(e=>inPeriod(e.date));
  const total = periodPayments.reduce((s,p)=>s+Number(p.amount||0),0);
  const totalExp = periodExpenses.reduce((s,e)=>s+Number(e.amount||0),0);
  document.getElementById('repTotal').textContent = fmtMoney(total);
  document.getElementById('repExpense').textContent = fmtMoney(totalExp);
  document.getElementById('repNet').textContent = fmtMoney(total - totalExp);

  const defaulters = students.map(s=>({s, b: studentDueBreakdown(s)})).filter(x=>x.b.total>0).sort((a,b)=>b.b.total-a.b.total);
  document.getElementById('lateFeeNote').textContent = (Number(settings.lateFeePerDay)||0) > 0
    ? `Late fee of ${fmtMoney(settings.lateFeePerDay)}/day applies after the ${settings.dueDay||10} of each month${settings.lateFeeCap>0?`, capped at ${fmtMoney(settings.lateFeeCap)}`:''}. Amounts below include any applicable late fee.`
    : 'No late fee rule is currently set — configure one in Settings if needed.';

  const byProg = {};
  periodPayments.forEach(p=>{ const st=studentById(p.studentId); if(!st) return; byProg[st.programId]=(byProg[st.programId]||0)+Number(p.amount||0); });
  const maxV = Math.max(1, ...Object.values(byProg));
  const barsHost = document.getElementById('repProgramBars');
  barsHost.innerHTML = Object.keys(byProg).length ? Object.entries(byProg).map(([pid,amt])=>{
    const p = programById(pid);
    return `<div class="bar-row"><div class="bar-label">${p?p.name:pid}</div><div class="bar-track"><div class="bar-fill" style="width:${(amt/maxV*100).toFixed(0)}%"></div></div><div class="bar-count">${fmtMoney(amt)}</div></div>`;
  }).join('') : '<div class="empty">No collection recorded for this period.</div>';

  const recBody = document.getElementById('recordsBody');
  recBody.innerHTML = periodPayments.map(p=>{
    const st = studentById(p.studentId); const prog = st ? programById(st.programId) : null;
    return `<tr><td class="mono">#${p.receiptNo}</td><td>${fmtDate(p.date)}</td><td>${st?st.name:'—'}</td><td>${prog?prog.name:'—'}</td><td>${p.purpose}</td><td>${p.mode}</td><td style="text-align:right" class="mono">${fmtMoney(p.amount)}</td></tr>`;
  }).join('');
  document.getElementById('recordsEmpty').style.display = periodPayments.length ? 'none' : 'block';

  const defBody = document.getElementById('defaultersBody');
  defBody.innerHTML = defaulters.map(({s,b})=>{
    const prog = programById(s.programId);
    return `<tr><td><b>${s.name}</b><div class="helper">${s.studentCode||''}</div></td><td>${prog?prog.name:'—'}</td><td>${s.contact||'—'}</td>
      <td style="text-align:right" class="mono due-owing">${fmtMoney(b.total)}${b.lateFee>0?`<div class="helper" style="text-align:right;color:var(--red);">incl. late fee ${fmtMoney(b.lateFee)}</div>`:''}</td>
      <td><div class="row-actions">
        <button class="btn btn-gold btn-sm" data-collect2="${s.id}">Collect</button>
        <button class="btn btn-ghost btn-sm" data-wa="${s.id}">WhatsApp</button>
      </div></td></tr>`;
  }).join('');
  document.getElementById('defaultersEmpty').style.display = defaulters.length ? 'none' : 'block';
  defBody.querySelectorAll('[data-collect2]').forEach(b=>b.addEventListener('click', ()=>openPaymentModal(b.dataset.collect2)));
  defBody.querySelectorAll('[data-wa]').forEach(b=>b.addEventListener('click', ()=>sendWhatsApp(studentById(b.dataset.wa))));

  window._periodPaymentsForPrint = periodPayments;
}
function printTableHTML(title, subtitle, rows, headers){
  return `<div class="records-print">
    <h2>The Horizon Academy</h2>
    <p>${title} · ${subtitle}</p>
    ${(settings.centreAddress||settings.centrePhone) ? `<p style="margin-top:-6px;">${settings.centreAddress||''}${settings.centreAddress&&settings.centrePhone?' · ':''}${settings.centrePhone||''}</p>` : ''}
    <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}
document.getElementById('btnPrintRecords').addEventListener('click', ()=>{
  const list = window._periodPaymentsForPrint || [];
  const rows = list.map(p=>{
    const st = studentById(p.studentId); const prog = st ? programById(st.programId) : null;
    return `<tr><td>#${p.receiptNo}</td><td>${fmtDate(p.date)}</td><td>${st?st.name:'—'}</td><td>${prog?prog.name:'—'}</td><td>${p.purpose}</td><td>${p.mode}</td><td>${fmtMoney(p.amount)}</td></tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:#888;">No payments in this period</td></tr>';
  const total = list.reduce((s,p)=>s+Number(p.amount||0),0);
  document.getElementById('printArea').innerHTML = printTableHTML('Collection Records', `${currentPeriodLabel()} · Total collected: ${fmtMoney(total)} · ${list.length} payment(s)`, rows, ['Slip#','Date','Student','Programme','Purpose','Mode','Amount']);
  setTimeout(()=>window.print(), 120);
});
document.getElementById('btnPrintDefaulters').addEventListener('click', ()=>{
  const defaulters = students.map(s=>({s, b: studentDueBreakdown(s)})).filter(x=>x.b.total>0).sort((a,b)=>b.b.total-a.b.total);
  const rows = defaulters.map(({s,b})=>{
    const prog = programById(s.programId);
    return `<tr><td>${s.name} (${s.studentCode||'—'})</td><td>${prog?prog.name:'—'}</td><td>${s.contact||'—'}</td><td>${fmtMoney(b.total)}</td></tr>`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:#888;">No outstanding dues</td></tr>';
  document.getElementById('printArea').innerHTML = printTableHTML('Defaulters List', `As of ${fmtDate(isoDate(new Date()))} · ${defaulters.length} student(s) owing`, rows, ['Name','Programme','Contact','Due Amount']);
  setTimeout(()=>window.print(), 120);
});

/* ---------- Bulk defaulter due-reminder slips (2 per A4 page, half-page each) ---------- */
function buildDueCopyHTML(s, b, prog){
  return `<div class="slip-copy">
    <div class="slip-copy-label" style="background:var(--red);">FEE DUE REMINDER</div>
    ${slipHeaderHTML()}
    <div class="slip-row"><span>Date</span><b>${fmtDate(isoDate(new Date()))}</b></div>
    <div class="slip-row"><span>Student</span><b>${s.name}</b></div>
    <div class="slip-row slip-sub"><span>Student ID</span><span>${s.studentCode||'—'}</span></div>
    <div class="slip-row"><span>Programme</span><b>${prog?prog.name:'—'}</b></div>
    <div class="slip-row"><span>Base Due</span><b>${fmtMoney(b.base)}</b></div>
    ${b.lateFee>0? `<div class="slip-row"><span>Late Fee (${b.daysLate}d)</span><b>${fmtMoney(b.lateFee)}</b></div>`:''}
    <div class="slip-amt"><span>Total Payable</span><span>${fmtMoney(b.total)}</span></div>
    <div class="slip-foot">Kindly clear your dues at your earliest convenience.<br>${settings.centrePhone? 'Contact: '+settings.centrePhone : ''}</div>
  </div>`;
}
document.getElementById('btnBulkSlips').addEventListener('click', ()=>{
  const defaulters = students.map(s=>({s, b: studentDueBreakdown(s)})).filter(x=>x.b.total>0).sort((a,b)=>a.s.name.localeCompare(b.s.name));
  if(!defaulters.length){ alert('No students currently have outstanding dues.'); return; }
  const pages = [];
  for(let i=0;i<defaulters.length;i+=2){
    const first = defaulters[i], second = defaulters[i+1];
    pages.push(`<div class="slip-sheet">
      ${buildDueCopyHTML(first.s, first.b, programById(first.s.programId))}
      <div class="slip-cut"><span>✂ cut here</span></div>
      ${second ? buildDueCopyHTML(second.s, second.b, programById(second.s.programId)) : '<div class="slip-copy"></div>'}
    </div>`);
  }
  document.getElementById('printArea').innerHTML = pages.join('');
  setTimeout(()=>window.print(), 150);
});

/* ============================================================ STUDENT VIEW / PRINT RECORD */
function studentRecordParts(s){
  const prog = programById(s.programId);
  const b = studentDueBreakdown(s);
  const hist = payments.filter(p=>p.studentId===s.id).sort((a,b)=> (b.date||'').localeCompare(a.date||'') || b.receiptNo-a.receiptNo);
  const rows = hist.map(p=>`<tr><td>#${p.receiptNo}</td><td>${fmtDate(p.date)}</td><td>${p.purpose}</td><td>${p.mode}</td><td style="text-align:right">${fmtMoney(p.amount)}</td></tr>`).join('')
    || '<tr><td colspan="5" style="text-align:center;color:#888;">No payments recorded yet</td></tr>';
  return {prog, b, hist, rows};
}
function openStudentView(id){
  const s = studentById(id);
  const {prog, b, rows} = studentRecordParts(s);
  const admRemaining = admissionFeeRemaining(s);
  document.getElementById('studentViewBody').innerHTML = `
    <div class="field-row">
      <div class="field"><label>Student ID</label><input type="text" value="${s.studentCode||'—'}" readonly></div>
      <div class="field"><label>Name</label><input type="text" value="${s.name}" readonly></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Programme</label><input type="text" value="${prog?prog.name:'—'}" readonly></div>
      <div class="field"><label>Contact</label><input type="text" value="${s.contact||'—'}" readonly></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Admitted</label><input type="text" value="${fmtDate(s.admissionDate)}" readonly></div>
      <div class="field"><label>Net Monthly Fee</label><input type="text" value="${fmtMoney(netMonthly(s))}${s.discount>0? ' (discount '+fmtMoney(s.discount)+')':''}" readonly></div>
    </div>
    <div class="field"><label>Admission Fee</label><input type="text" value="${fmtMoney(admissionFeePaidAmount(s.id))} paid of ${fmtMoney(admissionFeeTarget(s))}${admRemaining>0? ' — '+fmtMoney(admRemaining)+' remaining':' — complete'}" readonly></div>
    <div class="dues-banner">
      <span>Current dues: <b class="${b.total>0?'due-owing':'due-clear'}">${b.total>0?fmtMoney(b.total):'Clear'}</b></span>
      ${b.lateFee>0? `<span>incl. late fee <b class="due-owing">${fmtMoney(b.lateFee)}</b> (${b.daysLate} days)</span>`:''}
    </div>
    <h3 style="margin-top:18px;">Payment History</h3>
    <div class="table-wrap"><table><thead><tr><th>Slip#</th><th>Date</th><th>Purpose</th><th>Mode</th><th style="text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
  document.getElementById('studentViewOverlay').dataset.studentId = s.id;
  document.getElementById('btnWhatsAppFromView').style.display = b.total>0 ? 'inline-flex' : 'none';
  openModal('studentViewOverlay');
}
document.getElementById('btnWhatsAppFromView').addEventListener('click', ()=>{
  const id = document.getElementById('studentViewOverlay').dataset.studentId;
  const s = studentById(id); if(s) sendWhatsApp(s);
});
document.getElementById('btnPrintIdCardFromView').addEventListener('click', ()=>{
  const id = document.getElementById('studentViewOverlay').dataset.studentId;
  const s = studentById(id); if(s) printIdCards([s]);
});

/* ---------- ID cards ---------- */
function initials(name){
  return (name||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || '?';
}
function buildIdCardHTML(s){
  const prog = programById(s.programId);
  const photoHTML = s.photo ? `<img class="idc-photo" src="${s.photo}">` : `<div class="idc-avatar">${initials(s.name)}</div>`;
  return `<div class="id-card">
    <div class="idc-side"></div>
    <div class="idc-body">
      <div class="idc-head">The Horizon Academy</div>
      <div class="idc-sub">Powered by ANASH</div>
      <div class="idc-main">
        ${photoHTML}
        <div class="idc-info">
          <b>${s.name}</b>
          ID: ${s.studentCode||'—'}<br>
          ${prog?prog.name:'—'}<br>
          ${s.contact||''}
        </div>
      </div>
      <div class="idc-foot">${settings.centreAddress||''}${settings.centreAddress&&settings.centrePhone?' · ':''}${settings.centrePhone||''}</div>
    </div>
  </div>`;
}
function printIdCards(list){
  if(!list || !list.length){ alert('No students to print.'); return; }
  document.getElementById('printArea').innerHTML = `<div class="id-card-grid">${list.map(buildIdCardHTML).join('')}</div>`;
  setTimeout(()=>window.print(), 120);
}

document.getElementById('btnPrintStudentRecord').addEventListener('click', ()=>{
  const id = document.getElementById('studentViewOverlay').dataset.studentId;
  const s = studentById(id); if(!s) return;
  const {prog, b, rows} = studentRecordParts(s);
  document.getElementById('printArea').innerHTML = `<div class="records-print">
    <h2>The Horizon Academy</h2>
    <p>Powered by ANASH · Student Record</p>
    ${(settings.centreAddress||settings.centrePhone) ? `<p style="margin-top:-6px;">${settings.centreAddress||''}${settings.centreAddress&&settings.centrePhone?' · ':''}${settings.centrePhone||''}</p>` : ''}
    <table><tbody>
      <tr><th style="width:140px;">Student ID</th><td>${s.studentCode||'—'}</td></tr>
      <tr><th>Name</th><td>${s.name}${s.father? ' (S/O '+s.father+')':''}</td></tr>
      <tr><th>Programme</th><td>${prog?prog.name:'—'}</td></tr>
      <tr><th>Contact</th><td>${s.contact||'—'}</td></tr>
      <tr><th>Admitted</th><td>${fmtDate(s.admissionDate)}</td></tr>
      <tr><th>Net Monthly Fee</th><td>${fmtMoney(netMonthly(s))}${s.discount>0? ' (discount '+fmtMoney(s.discount)+(s.discountReason?' — '+s.discountReason:'')+')':''}</td></tr>
      <tr><th>Admission Fee</th><td>${fmtMoney(admissionFeePaidAmount(s.id))} paid of ${fmtMoney(admissionFeeTarget(s))}</td></tr>
      <tr><th>Current Dues</th><td>${b.total>0?fmtMoney(b.total):'Clear'}${b.lateFee>0?' (incl. late fee '+fmtMoney(b.lateFee)+')':''}</td></tr>
    </tbody></table>
    <p style="margin-top:14px;"><b>Payment History</b></p>
    <table><thead><tr><th>Slip#</th><th>Date</th><th>Purpose</th><th>Mode</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
  setTimeout(()=>window.print(), 120);
});

/* ============================================================ DEMO DATA */
function seedDemoData(){
  const firstNames = ['Ayesha','Ali','Fatima','Hassan','Zainab','Bilal','Sara','Usman','Mahnoor','Hamza','Areeba','Danish','Iqra','Talha','Komal'];
  const lastNames = ['Khan','Raza','Sheikh','Ahmed','Malik','Hussain','Iqbal','Tariq','Siddiqui','Farooq','Baig','Qureshi','Chaudhry','Abbasi','Rizvi'];
  const modes = ['Cash','Bank Transfer','Easypaisa','JazzCash'];
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const usedNames = new Set();
  const today = new Date();

  for(let i=0;i<10;i++){
    let name;
    do{ name = `${pick(firstNames)} ${pick(lastNames)}`; } while(usedNames.has(name));
    usedNames.add(name);

    const prog = pick(programs);
    const monthsAgo = 1 + Math.floor(Math.random()*7); // admitted 1-7 months ago
    const admDate = new Date(today.getFullYear(), today.getMonth()-monthsAgo, 1 + Math.floor(Math.random()*20));
    const hasDiscount = Math.random() < 0.3;
    const discount = hasDiscount ? [200,300,500,800][Math.floor(Math.random()*4)] : 0;
    const discountReason = hasDiscount ? pick(['Sibling discount','Merit scholarship','Financial hardship','Staff family']) : '';

    const student = {
      id: uid(), studentCode: nextStudentCode(), name,
      father: `${pick(firstNames)} ${pick(lastNames)}`,
      contact: `03${Math.floor(Math.random()*10)}-${Math.floor(1000000+Math.random()*8999999)}`,
      photo: '', programId: prog.id, admissionDate: isoDate(admDate),
      monthlyFee: prog.fee, discount, discountReason, admissionFee: prog.admissionFee,
    };
    students.push(student);

    const net = Math.max(prog.fee - discount, 0);
    const monthsElapsedForStudent = Math.max((today.getFullYear()-admDate.getFullYear())*12 + (today.getMonth()-admDate.getMonth()) + 1, 0);
    const monthsToPay = Math.max(monthsElapsedForStudent - Math.floor(Math.random()*3), 0); // leaves 0-2 months as dues sometimes
    for(let m=0;m<monthsToPay;m++){
      const payDate = new Date(admDate.getFullYear(), admDate.getMonth()+m, 5+Math.floor(Math.random()*10));
      if(payDate>today) break;
      payments.push({ id: uid(), receiptNo: settings.receiptSeq++, studentId: student.id, date: isoDate(payDate), amount: net, purpose:'Monthly Fee', mode: pick(modes), note:'' });
    }
    if(Math.random() < 0.7){
      const admPayDate = new Date(admDate);
      const admPaidFull = Math.random() < 0.75;
      payments.push({ id: uid(), receiptNo: settings.receiptSeq++, studentId: student.id, date: isoDate(admPayDate), amount: admPaidFull ? prog.admissionFee : Math.round(prog.admissionFee*0.5), purpose:'Admission Fee', mode: pick(modes), note: admPaidFull?'':'Installment 1 of 2' });
    }
  }

  const expCats = ['Rent','Salaries','Utilities','Stationery','Maintenance'];
  for(let i=0;i<4;i++){
    const d = new Date(today.getFullYear(), today.getMonth()-Math.floor(Math.random()*3), 1+Math.floor(Math.random()*25));
    expenses.push({ id: uid(), date: isoDate(d), amount: 3000+Math.floor(Math.random()*15000), category: pick(expCats), note: 'Sample entry' });
  }

  persistAll();
  renderDashboard(); renderStudents(); renderPayments(); renderExpenses(); renderRecords();
  alert('Added 10 random demo students with sample payments and expenses.');
}
document.getElementById('btnSeedDemo').addEventListener('click', ()=>{
  if(confirm('Add 10 random sample students with sample payment history and a few expenses? This only adds data — nothing existing is changed.')) seedDemoData();
});

/* ============================================================ SETTINGS */
function renderSettingsForm(){
  document.getElementById('setAddress').value = settings.centreAddress||'';
  document.getElementById('setPhone').value = settings.centrePhone||'';
  document.getElementById('setFooterNote').value = settings.receiptFooterNote||'';
  document.getElementById('setDueDay').value = settings.dueDay||10;
  document.getElementById('setLateFeePerDay').value = settings.lateFeePerDay||0;
  document.getElementById('setLateFeeCap').value = settings.lateFeeCap||0;
  document.getElementById('setPinEnabled').checked = !!settings.pinEnabled;
  document.getElementById('setNewPin').value = '';
  document.getElementById('setConfirmPin').value = '';
  document.getElementById('pinStatusText').textContent = settings.pinEnabled ? 'PIN lock is currently ON.' : 'Not enabled — anyone opening this file can view all data.';
  document.getElementById('syncStatusDetail').textContent = SERVER_CONNECTED
    ? 'Connected to the app server and its SQLite database. Any device that opens this page pointed at the same server (e.g. http://<this computer\'s IP>:3000 over your local network, or a public URL if you deploy the server) reads and writes the same live data. There are no separate staff logins — anyone who can reach this address can view and edit everything, so keep the address/network private or add your own login if that matters to you.'
    : 'Not connected to the server right now. Make sure the server is running (npm start in the project folder) and this page was opened from it (e.g. http://localhost:3000), then click Refresh below.';
}
document.getElementById('btnRefreshSync').addEventListener('click', async ()=>{
  try{
    await loadAll();
    renderDashboard(); renderStudents(); renderPayments(); renderExpenses(); renderFeeStructure(); renderRecords(); renderSettingsForm(); renderTrash();
    alert('Refreshed with the latest data from the server.');
  }catch(e){
    renderSettingsForm();
    alert('Could not reach the server. Make sure it is running and try again.');
  }
});
document.getElementById('btnSaveCentre').addEventListener('click', ()=>{
  settings.centreAddress = document.getElementById('setAddress').value.trim();
  settings.centrePhone = document.getElementById('setPhone').value.trim();
  settings.receiptFooterNote = document.getElementById('setFooterNote').value.trim() || DEFAULT_SETTINGS.receiptFooterNote;
  persistAll(); alert('Centre details saved.');
});
document.getElementById('btnSaveLateFee').addEventListener('click', ()=>{
  settings.dueDay = Math.min(Math.max(Number(document.getElementById('setDueDay').value)||10,1),28);
  settings.lateFeePerDay = Number(document.getElementById('setLateFeePerDay').value)||0;
  settings.lateFeeCap = Number(document.getElementById('setLateFeeCap').value)||0;
  persistAll(); renderRecords_safe(); alert('Fee rules saved.');
});
function renderRecords_safe(){ try{ renderRecords(); }catch(e){} try{ renderStudents(); }catch(e){} try{ renderDashboard(); }catch(e){} }

function simpleHash(str){ return btoa(unescape(encodeURIComponent('horizon::'+str))); }
document.getElementById('btnSavePin').addEventListener('click', ()=>{
  const enabled = document.getElementById('setPinEnabled').checked;
  const newPin = document.getElementById('setNewPin').value.trim();
  const confirmPin = document.getElementById('setConfirmPin').value.trim();
  if(enabled && !settings.pinHash && !newPin){ alert('Set a PIN (4–8 digits) to enable the lock.'); return; }
  if(newPin || confirmPin){
    if(newPin.length<4 || newPin.length>8 || !/^\d+$/.test(newPin)){ alert('PIN must be 4–8 digits.'); return; }
    if(newPin!==confirmPin){ alert('PIN and confirmation do not match.'); return; }
    settings.pinHash = simpleHash(newPin);
  }
  settings.pinEnabled = enabled;
  if(!enabled) settings.pinHash = settings.pinHash; // keep hash stored but inactive, so re-enabling doesn't force reset
  persistAll(); renderSettingsForm();
  alert('PIN settings saved.');
});

/* ---------- Backup & Restore ---------- */
document.getElementById('btnExportData').addEventListener('click', ()=>{
  const backup = { exportedAt: new Date().toISOString(), programs, students, payments, expenses, settings, trash };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ymd = isoDate(new Date());
  a.href = url; a.download = `horizon-academy-backup-${ymd}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
document.getElementById('btnImportTrigger').addEventListener('click', ()=>document.getElementById('importFileInput').click());
document.getElementById('importFileInput').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!data || !Array.isArray(data.students)){ alert('This file does not look like a valid Horizon Academy backup.'); return; }
      if(!confirm('This will REPLACE all current data in this app with the backup file. Continue?')) return;
      programs = data.programs || DEFAULT_PROGRAMS;
      students = data.students || [];
      payments = data.payments || [];
      expenses = data.expenses || [];
      settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
      trash = data.trash || {students:[], payments:[], expenses:[]};
      persistAll();
      renderDashboard(); renderStudents(); renderPayments(); renderFeeStructure(); renderExpenses(); renderRecords(); renderSettingsForm(); renderTrash();
      alert('Backup restored successfully.');
    }catch(err){ alert('Could not read this file — make sure it is a Horizon Academy .json backup.'); }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ---------- Excel export / import ---------- */
function requireLib(lib, name){
  if(!lib){ alert(`${name} could not load — check your internet connection and try again.`); return false; }
  return true;
}
function studentsForExport(){
  return students.map(s=>{
    const prog = programById(s.programId);
    return {
      'Student ID': s.studentCode||'', 'Name': s.name, "Father's Name": s.father||'', 'Contact': s.contact||'',
      'Programme': prog?prog.name:'', 'Admission Date': s.admissionDate||'',
      'Monthly Fee': s.monthlyFee||0, 'Discount': s.discount||0, 'Discount Reason': s.discountReason||'',
      'Admission Fee Target': admissionFeeTarget(s), 'Admission Fee Paid': admissionFeePaidAmount(s.id),
      'Current Due': studentDue(s),
    };
  });
}
function paymentsForExport(list){
  return (list||payments).map(p=>{
    const st = studentById(p.studentId); const prog = st ? programById(st.programId) : null;
    return { 'Slip No': p.receiptNo, 'Date': p.date, 'Student ID': st?st.studentCode:'', 'Student Name': st?st.name:'(deleted)',
      'Programme': prog?prog.name:'', 'Purpose': p.purpose, 'Mode': p.mode, 'Amount': p.amount, 'Note': p.note||'' };
  });
}
function expensesForExport(list){
  return (list||expenses).map(e=>({ 'Date': e.date, 'Category': e.category, 'Note': e.note||'', 'Amount': e.amount }));
}
function feeStructureForExport(){
  return programs.map(p=>({ 'Programme': p.name, 'Category': p.category, 'Monthly Fee': p.fee, 'Admission Fee': p.admissionFee }));
}
function downloadWorkbook(sheets, filenamePrefix){
  if(!requireLib(window.XLSX, 'Excel export library')) return;
  const wb = XLSX.utils.book_new();
  sheets.forEach(([name, rows])=>{
    const ws = XLSX.utils.json_to_sheet(rows.length?rows:[{}]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `${filenamePrefix}-${isoDate(new Date())}.xlsx`);
}
document.getElementById('btnExportExcel').addEventListener('click', ()=>{
  downloadWorkbook([
    ['Students', studentsForExport()], ['Payments', paymentsForExport()],
    ['Expenses', expensesForExport()], ['Fee Structure', feeStructureForExport()],
  ], 'horizon-academy-data');
});
document.getElementById('btnExcelRecords').addEventListener('click', ()=>{
  downloadWorkbook([['Payments', paymentsForExport(window._periodPaymentsForPrint||[])]], 'horizon-academy-records');
});
document.getElementById('btnExcelDefaulters').addEventListener('click', ()=>{
  const rows = students.map(s=>({s, b:studentDueBreakdown(s)})).filter(x=>x.b.total>0).map(({s,b})=>{
    const prog = programById(s.programId);
    return { 'Student ID': s.studentCode||'', 'Name': s.name, 'Programme': prog?prog.name:'', 'Contact': s.contact||'',
      'Base Due': b.base, 'Late Fee': b.lateFee, 'Total Due': b.total };
  });
  downloadWorkbook([['Defaulters', rows]], 'horizon-academy-defaulters');
});

document.getElementById('btnImportExcelTrigger').addEventListener('click', ()=>document.getElementById('importExcelInput').click());
document.getElementById('importExcelInput').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  if(!requireLib(window.XLSX, 'Excel import library')){ e.target.value=''; return; }
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
      let addedS=0, updatedS=0, addedP=0, addedE=0;

      if(wb.SheetNames.includes('Students')){
        XLSX.utils.sheet_to_json(wb.Sheets['Students']).forEach(r=>{
          const code = String(r['Student ID']||r['ID']||'').trim();
          const existing = code ? students.find(s=>s.studentCode===code) : null;
          const progName = String(r['Programme']||r['Program']||'').trim();
          const prog = programs.find(p=>p.name===progName) || (existing?programById(existing.programId):null) || programs[0];
          const rec = {
            name: String(r['Name']||r['Full Name']||(existing?existing.name:'Unnamed')).trim(),
            father: String(r["Father's Name"]||r['Father']||(existing?existing.father:'')||'').trim(),
            contact: String(r['Contact']||(existing?existing.contact:'')||'').trim(),
            programId: prog.id,
            admissionDate: r['Admission Date'] ? String(r['Admission Date']).slice(0,10) : (existing?existing.admissionDate:isoDate(new Date())),
            monthlyFee: r['Monthly Fee']!=null ? Number(r['Monthly Fee'])||0 : (existing?existing.monthlyFee:prog.fee),
            discount: Number(r['Discount'])||0,
            discountReason: String(r['Discount Reason']||'').trim(),
            admissionFee: r['Admission Fee Target']!=null ? Number(r['Admission Fee Target'])||0 : (existing?existing.admissionFee:prog.admissionFee),
          };
          if(existing){ Object.assign(existing, rec); updatedS++; }
          else{ students.push({id:uid(), studentCode: code || nextStudentCode(), ...rec}); addedS++; }
        });
      }
      if(wb.SheetNames.includes('Payments')){
        XLSX.utils.sheet_to_json(wb.Sheets['Payments']).forEach(r=>{
          const slipNo = Number(r['Slip No']);
          if(slipNo && payments.some(p=>p.receiptNo===slipNo)) return; // skip already-imported slips
          const code = String(r['Student ID']||'').trim();
          const st = code ? students.find(s=>s.studentCode===code) : students.find(s=>s.name===String(r['Student Name']||'').trim());
          if(!st) return;
          const receiptNo = slipNo || settings.receiptSeq++;
          if(receiptNo>=settings.receiptSeq) settings.receiptSeq = receiptNo+1;
          payments.push({
            id: uid(), receiptNo, studentId: st.id,
            date: r['Date'] ? String(r['Date']).slice(0,10) : isoDate(new Date()),
            amount: Number(r['Amount'])||0, purpose: String(r['Purpose']||'Other'),
            mode: String(r['Mode']||'Cash'), note: String(r['Note']||''),
          });
          addedP++;
        });
      }
      if(wb.SheetNames.includes('Expenses')){
        XLSX.utils.sheet_to_json(wb.Sheets['Expenses']).forEach(r=>{
          if(!r['Amount']) return;
          expenses.push({ id: uid(), date: r['Date']?String(r['Date']).slice(0,10):isoDate(new Date()),
            amount: Number(r['Amount'])||0, category: String(r['Category']||'Other'), note: String(r['Note']||'') });
          addedE++;
        });
      }
      persistAll();
      renderDashboard(); renderStudents(); renderPayments(); renderExpenses(); renderRecords();
      alert(`Import complete.\nStudents added: ${addedS}, updated: ${updatedS}\nPayments added: ${addedP}\nExpenses added: ${addedE}`);
    }catch(err){ alert('Could not read this Excel file. Make sure sheets are named Students / Payments / Expenses with matching column headers.'); }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
});

/* ---------- PDF export ---------- */
function pdfHeader(doc, subtitle){
  doc.setFontSize(15); doc.text('The Horizon Academy', 14, 15);
  doc.setFontSize(9); doc.setTextColor(120);
  doc.text(`Powered by ANASH${settings.centreAddress?' · '+settings.centreAddress:''}${settings.centrePhone?' · '+settings.centrePhone:''}`, 14, 21);
  if(subtitle) doc.text(subtitle, 14, 26);
  doc.setTextColor(0);
}
document.getElementById('btnExportPDF').addEventListener('click', ()=>{
  if(!requireLib(window.jspdf, 'PDF export library')) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc, `Data Export · ${fmtDate(isoDate(new Date()))}`);
  doc.setFontSize(12); doc.text('Students', 14, 34);
  doc.autoTable({ startY:38, styles:{fontSize:8}, head:[['ID','Name','Programme','Contact','Net Fee','Due']],
    body: students.map(s=>[s.studentCode||'', s.name, programById(s.programId)?.name||'', s.contact||'', fmtMoney(netMonthly(s)), fmtMoney(studentDue(s))]) });
  doc.addPage(); pdfHeader(doc, 'Payments');
  doc.autoTable({ startY:30, styles:{fontSize:8}, head:[['Slip#','Date','Student','Purpose','Mode','Amount']],
    body: payments.map(p=>{ const st=studentById(p.studentId); return [p.receiptNo, fmtDate(p.date), st?st.name:'—', p.purpose, p.mode, fmtMoney(p.amount)]; }) });
  doc.addPage(); pdfHeader(doc, 'Expenses');
  doc.autoTable({ startY:30, styles:{fontSize:8}, head:[['Date','Category','Note','Amount']],
    body: expenses.map(e=>[fmtDate(e.date), e.category, e.note||'', fmtMoney(e.amount)]) });
  doc.save(`horizon-academy-report-${isoDate(new Date())}.pdf`);
});
document.getElementById('btnPdfRecords').addEventListener('click', ()=>{
  if(!requireLib(window.jspdf, 'PDF export library')) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const list = window._periodPaymentsForPrint || [];
  pdfHeader(doc, `Collection Records · ${currentPeriodLabel()}`);
  doc.autoTable({ startY:30, styles:{fontSize:8}, head:[['Slip#','Date','Student','Programme','Purpose','Mode','Amount']],
    body: list.map(p=>{ const st=studentById(p.studentId); const prog = st?programById(st.programId):null; return [p.receiptNo, fmtDate(p.date), st?st.name:'—', prog?prog.name:'—', p.purpose, p.mode, fmtMoney(p.amount)]; }) });
  doc.save(`horizon-academy-records-${isoDate(new Date())}.pdf`);
});
document.getElementById('btnPdfDefaulters').addEventListener('click', ()=>{
  if(!requireLib(window.jspdf, 'PDF export library')) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const defaulters = students.map(s=>({s, b: studentDueBreakdown(s)})).filter(x=>x.b.total>0).sort((a,b)=>b.b.total-a.b.total);
  pdfHeader(doc, `Defaulters List · As of ${fmtDate(isoDate(new Date()))}`);
  doc.autoTable({ startY:30, styles:{fontSize:8}, head:[['ID','Name','Programme','Contact','Due']],
    body: defaulters.map(({s,b})=>[s.studentCode||'', s.name, programById(s.programId)?.name||'', s.contact||'', fmtMoney(b.total)]) });
  doc.save(`horizon-academy-defaulters-${isoDate(new Date())}.pdf`);
});

/* ============================================================ PIN LOCK SCREEN */
function checkLock(){
  if(settings.pinEnabled && settings.pinHash){
    document.getElementById('app').style.display = 'none';
    document.getElementById('lockScreen').classList.add('show');
  } else {
    document.getElementById('app').style.display = 'flex';
    document.getElementById('lockScreen').classList.remove('show');
  }
}
function tryUnlock(){
  const val = document.getElementById('lockPinInput').value.trim();
  if(simpleHash(val)===settings.pinHash){
    document.getElementById('lockScreen').classList.remove('show');
    document.getElementById('app').style.display = 'flex';
    document.getElementById('lockPinInput').value = '';
    document.getElementById('lockErr').textContent = '';
  } else {
    document.getElementById('lockErr').textContent = 'Incorrect PIN. Try again.';
  }
}
document.getElementById('btnUnlock').addEventListener('click', tryUnlock);
document.getElementById('lockPinInput').addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(); });

/* ---------- Init ---------- */
document.getElementById('yr').textContent = new Date().getFullYear();
(async function init(){
  const syncEl = document.getElementById('syncStatus');
  const loadingText = document.getElementById('loadingText');
  syncEl.textContent = 'connecting…';
  loadingText.textContent = 'Connecting to server…';
  try{
    await loadAll();
    await persistAll();
  }catch(e){
    syncEl.textContent = 'offline — server not reachable';
    loadingText.textContent = 'Could not connect to the server. Make sure Apache and MySQL are running in the XAMPP Control Panel, that the "horizon_academy" database exists (import database/schema.sql), and that you opened this page as http://localhost/horizon-academy-app/ (not as a local file). Check api/health.php directly for the exact error, then reload.'
      + ' — Details: ' + (e && e.message ? e.message : e);
    return;
  }
  syncEl.textContent = 'connected to server';
  checkLock();
  renderDashboard();
  document.getElementById('loadingScreen').classList.remove('show');
})();

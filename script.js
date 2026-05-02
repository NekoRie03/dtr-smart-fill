// OJT DTR – full logic (persistence, smart fill, calculations)
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const LS_GLOBAL = "ojt_dtr_v5_permonth";

let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveToStorage(), 400); }

function getStorageKey(bid, year, month) { return `${bid}_${year}_${month}`; }

let allTimesCache = {};
let currentYear = 2026, currentMonth1 = 4, currentMonth2 = 5;

function getDayInfo(bid, dayNum) {
  const year = parseInt(document.getElementById('cfgYear').value);
  const monthSel = bid === 'block1' ? 'cfgMonth1' : 'cfgMonth2';
  const month = parseInt(document.getElementById(monthSel).value);
  const date = new Date(year, month, dayNum);
  return { year, month, isSunday: date.getDay() === 0, isSaturday: date.getDay() === 6, date };
}

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [h,m] = timeStr.split(':').map(Number);
  return (isNaN(h)||isNaN(m)) ? null : h*60+m;
}

function recalcRow(bid, dayNum) {
  const ai = document.getElementById(`${bid}_ai_${dayNum}`)?.value;
  const ao = document.getElementById(`${bid}_ao_${dayNum}`)?.value;
  const pi = document.getElementById(`${bid}_pi_${dayNum}`)?.value;
  const po = document.getElementById(`${bid}_po_${dayNum}`)?.value;
  const hoursSpan = document.getElementById(`${bid}_h_${dayNum}`);
  const minsSpan = document.getElementById(`${bid}_m_${dayNum}`);
  if (!hoursSpan || !minsSpan) return;

  let totalMins = 0;
  if (ai && ao) { let s=toMinutes(ai), e=toMinutes(ao); if(s!==null && e!==null && e>s) totalMins += (e-s); }
  if (pi && po) { let s=toMinutes(pi), e=toMinutes(po); if(s!==null && e!==null && e>s) totalMins += (e-s); }
  if (ai && po && (!ao||!pi)) { let s=toMinutes(ai), e=toMinutes(po); if(s!==null && e!==null && e>s) totalMins = e-s; }

  const hrs = Math.floor(totalMins/60);
  const mins = totalMins%60;
  hoursSpan.textContent = totalMins>0 ? hrs : '';
  minsSpan.textContent = totalMins>0 ? String(mins).padStart(2,'0') : '';
  return totalMins;
}

function updateBlockTotals(bid, maxDays) {
  let total = 0;
  for(let d=1; d<=maxDays; d++) {
    let h = parseInt(document.getElementById(`${bid}_h_${d}`)?.textContent) || 0;
    let m = parseInt(document.getElementById(`${bid}_m_${d}`)?.textContent) || 0;
    total += (h*60+m);
  }
  const totH = document.getElementById(`${bid}_th`);
  const totM = document.getElementById(`${bid}_tm`);
  if(totH) totH.textContent = Math.floor(total/60);
  if(totM) totM.textContent = String(total%60).padStart(2,'0');
}

function onTimeEdited(bid, day) {
  recalcRow(bid, day);
  const year = parseInt(document.getElementById('cfgYear').value);
  const monthSel = bid === 'block1' ? 'cfgMonth1' : 'cfgMonth2';
  const month = parseInt(document.getElementById(monthSel).value);
  const daysInMonth = new Date(year, month+1, 0).getDate();
  updateBlockTotals(bid, daysInMonth);
  saveCurrentBlockTimesToCache(bid, year, month);
  scheduleSave();
}

function saveCurrentBlockTimesToCache(bid, year, month) {
  const key = getStorageKey(bid, year, month);
  const dim = new Date(year, month+1, 0).getDate();
  const times = {};
  for(let d=1; d<=dim; d++) {
    const dt = new Date(year, month, d);
    if(dt.getDay() === 0) continue;
    ['ai','ao','pi','po'].forEach(k => {
      const el = document.getElementById(`${bid}_${k}_${d}`);
      if(el) times[`${k}_${d}`] = el.value;
    });
  }
  allTimesCache[key] = times;
}

function restoreBlockTimes(bid, year, month) {
  const key = getStorageKey(bid, year, month);
  const saved = allTimesCache[key];
  if(!saved) return;
  const dim = new Date(year, month+1, 0).getDate();
  for(let d=1; d<=dim; d++) {
    const dt = new Date(year, month, d);
    if(dt.getDay() === 0) continue;
    for(let k of ['ai','ao','pi','po']) {
      const val = saved[`${k}_${d}`];
      const field = document.getElementById(`${bid}_${k}_${d}`);
      if(field && val !== undefined) field.value = val;
    }
  }
  for(let d=1; d<=dim; d++) {
    if(new Date(year, month, d).getDay() !== 0) recalcRow(bid, d);
  }
  updateBlockTotals(bid, dim);
}

function handleSmartFill(e) {
  const input = e.target;
  if(!input || input.tagName !== 'INPUT' || input.type !== 'time') return;
  const parts = input.id?.split('_');
  if(!parts || parts.length !== 3) return;
  const bid = parts[0], fieldType = parts[1], dayNum = parseInt(parts[2]);
  if(isNaN(dayNum)) return;
  if(fieldType !== 'ai' && fieldType !== 'po') return;
  if(input.value && input.value.trim() !== "") return;
  const { isSunday } = getDayInfo(bid, dayNum);
  if(isSunday) return;
  let defaultValue = fieldType === 'ai' ? "08:00" : "17:00";
  if(defaultValue) {
    input.value = defaultValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function buildBlock(bid, monthIdx, year, employeeName) {
  const daysInMonth = new Date(year, monthIdx+1, 0).getDate();
  let tbodyRows = '';
  for(let d=1; d<=31; d++) {
    const isReal = d <= daysInMonth;
    if(!isReal) {
      tbodyRows += `<tr class="empty"><td class="day-num">${d}<\/td><td class="time-cell"><\/td><td class="time-cell"><\/td><td class="time-cell"><\/td><td class="time-cell"><\/td><td class="val-cell"><\/td><td class="val-cell"><\/td><\/tr>`;
      continue;
    }
    const dt = new Date(year, monthIdx, d);
    const dayOfWeek = dt.getDay();
    if(dayOfWeek === 0) {
      tbodyRows += `<tr class="sunday"><td class="day-num">${d}<\/td><td colspan="4" class="sun-label">Sunday<\/td><td class="val-cell"><\/td><td class="val-cell"><\/td><\/tr>`;
      continue;
    }
    const rowClass = dayOfWeek === 6 ? 'saturday' : '';
    tbodyRows += `<tr class="${rowClass}">
      <td class="day-num">${d}<\/td>
      <td class="time-cell"><input type="time" id="${bid}_ai_${d}" autocomplete="off"><\/td>
      <td class="time-cell"><input type="time" id="${bid}_ao_${d}" autocomplete="off"><\/td>
      <td class="time-cell"><input type="time" id="${bid}_pi_${d}" autocomplete="off"><\/td>
      <td class="time-cell"><input type="time" id="${bid}_po_${d}" autocomplete="off"><\/td>
      <td class="val-cell" id="${bid}_h_${d}"><\/td>
      <td class="val-cell" id="${bid}_m_${d}"><\/td>
     <\/tr>`;
  }
  const monthName = MONTHS[monthIdx];
  const unifiedText = `Official hours (Monday to Saturday): 8:00 AM – 5:00 PM`;
  const fullHTML = `
    <div class="dtr-title"><h2>DAILY TIME RECORD</h2><div class="ooo">••• o0o •••</div></div>
    <div class="name-wrap"><span class="name-line emp-name">${escapeHtml(employeeName)}</span></div>
    <div class="name-label">(trainee / employee)</div>
    <div class="dtr-meta">
      <div class="meta-month"><span class="ml">For the month of</span><span class="mv"> ${monthName} ${year}</span></div>
      <div class="meta-hours"><p>${unifiedText}</p></div>
    </div>
    <table class="dtr-table">
      <thead><tr><th rowspan="2">Day</th><th colspan="2">A.M.</th><th colspan="2">P.M.</th><th colspan="2">Total<\/th><\/tr>
      <tr><th>Arrival</th><th>Departure</th><th>Arrival</th><th>Departure</th><th>Hours</th><th>Mins</th><\/tr><\/thead>
      <tbody>${tbodyRows}<\/tbody>
      <tfoot><tr><td colspan="5" class="tlabel">TOTAL HOURS (Month)<\/td><td class="tval" id="${bid}_th">0<\/td><td class="tval" id="${bid}_tm">00<\/td><\/tr><\/tfoot>
    <\/table>
    <div class="cert">I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.</div>
    <div class="verified">Verified as per prescribed office hours (8:00 AM – 5:00 PM).</div>
    <div class="sig">SUPERVISOR / IN-CHARGE</div>
  `;
  document.getElementById(bid).innerHTML = fullHTML;
  for(let d=1; d<=daysInMonth; d++) {
    if(new Date(year, monthIdx, d).getDay() === 0) continue;
    ['ai','ao','pi','po'].forEach(code => {
      const field = document.getElementById(`${bid}_${code}_${d}`);
      if(field) {
        field.removeEventListener('input', () => onTimeEdited(bid, d));
        field.addEventListener('input', () => onTimeEdited(bid, d));
      }
    });
  }
  restoreBlockTimes(bid, year, monthIdx);
}

function escapeHtml(str) {
  if(!str) return '';
  return str.replace(/[&<>]/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m] || m));
}

function buildAll() {
  const year = parseInt(document.getElementById('cfgYear').value);
  const m1 = parseInt(document.getElementById('cfgMonth1').value);
  const m2 = parseInt(document.getElementById('cfgMonth2').value);
  const name = document.getElementById('cfgName').value.trim() || 'OJT Trainee';
  buildBlock('block1', m1, year, name);
  buildBlock('block2', m2, year, name);
}

function updateNameAndSave() {
  const newName = document.getElementById('cfgName').value.trim() || '';
  document.querySelectorAll('.emp-name').forEach(el => el.textContent = newName);
  scheduleSave();
}

function applyColor(hex) {
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-light', hex + '15');
}

function saveToStorage() {
  const globalConfig = {
    name: document.getElementById('cfgName').value,
    color: document.getElementById('cfgColor').value,
    year: parseInt(document.getElementById('cfgYear').value),
    month1: parseInt(document.getElementById('cfgMonth1').value),
    month2: parseInt(document.getElementById('cfgMonth2').value),
    allTimes: allTimesCache
  };
  localStorage.setItem(LS_GLOBAL, JSON.stringify(globalConfig));
  const ind = document.getElementById('savedIndicator');
  ind.classList.add('show');
  setTimeout(() => ind.classList.remove('show'), 1300);
}

function loadFromStorage() {
  const raw = localStorage.getItem(LS_GLOBAL);
  if(!raw) return false;
  try {
    const data = JSON.parse(raw);
    if(data.name) document.getElementById('cfgName').value = data.name;
    if(data.color) { document.getElementById('cfgColor').value = data.color; applyColor(data.color); }
    if(data.year) document.getElementById('cfgYear').value = data.year;
    if(data.month1 !== undefined) document.getElementById('cfgMonth1').value = data.month1;
    if(data.month2 !== undefined) document.getElementById('cfgMonth2').value = data.month2;
    if(data.allTimes) allTimesCache = data.allTimes;
    return true;
  } catch(e) { return false; }
}

function onMonthChange() {
  const year = parseInt(document.getElementById('cfgYear').value);
  const m1 = parseInt(document.getElementById('cfgMonth1').value);
  const m2 = parseInt(document.getElementById('cfgMonth2').value);
  if(document.getElementById('block1')?.innerHTML) {
    saveCurrentBlockTimesToCache('block1', year, currentMonth1);
    saveCurrentBlockTimesToCache('block2', year, currentMonth2);
  }
  currentMonth1 = m1; currentMonth2 = m2;
  buildAll();
  scheduleSave();
}

function onYearChange() {
  const year = parseInt(document.getElementById('cfgYear').value);
  if(document.getElementById('block1')?.innerHTML) {
    saveCurrentBlockTimesToCache('block1', currentYear, currentMonth1);
    saveCurrentBlockTimesToCache('block2', currentYear, currentMonth2);
  }
  currentYear = year;
  buildAll();
  scheduleSave();
}

function clearAllRecords() {
  if(!confirm('Clear all entered times for all months? This will reset all saved data.')) return;
  allTimesCache = {};
  buildAll();
  scheduleSave();
}

window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  currentYear = parseInt(document.getElementById('cfgYear').value);
  currentMonth1 = parseInt(document.getElementById('cfgMonth1').value);
  currentMonth2 = parseInt(document.getElementById('cfgMonth2').value);
  buildAll();
  document.body.addEventListener('focus', handleSmartFill, true);
  updateNameAndSave();

  // ---------- Night Mode Toggle ----------
  const toggleBtn = document.getElementById('nightModeToggle');
  if (toggleBtn) {
    if (localStorage.getItem('nightMode') === 'true') {
      document.body.classList.add('night-mode');
      toggleBtn.textContent = '☀️ Light Mode';
    }
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('night-mode');
      const isNight = document.body.classList.contains('night-mode');
      localStorage.setItem('nightMode', isNight);
      toggleBtn.textContent = isNight ? '☀️ Light Mode' : '🌙 Night Mode';
    });
  }
});

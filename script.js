'use strict';

const STORAGE_KEY = 'notenverwaltung_data_v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultData() {
  return {
    subjects: [],
    examTypes: [
      { id: uid(), name: 'Schriftlich' },
      { id: uid(), name: 'Mündlich' },
      { id: uid(), name: 'Vortrag' }
    ],
    grades: []
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed.subjects || !parsed.examTypes || !parsed.grades) throw new Error('Ungültiges Format');
    return parsed;
  } catch (e) {
    console.error('Fehler beim Laden der Daten:', e);
    queueMicrotask(() => showToast('Gespeicherte Daten waren beschädigt. Es wurde neu gestartet.', 'error'));
    return defaultData();
  }
}

let state = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error(e);
    showToast('Speichern fehlgeschlagen (Speicher eventuell voll).', 'error');
  }
}

function jsRound(value) {
  return Math.floor(value + 0.5);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function roundToHalf(avg) {
  let r = jsRound(avg * 2) / 2;
  return Math.min(6, Math.max(1, r));
}

function subjectById(id) {
  return state.subjects.find(s => s.id === id);
}

function examTypeName(id) {
  const et = state.examTypes.find(e => e.id === id);
  return et ? et.name : 'Unbekannt';
}

function getSubjectGrades(subjectId) {
  return state.grades.filter(g => g.subjectId === subjectId);
}

function weightedAverage(grades) {
  const totalWeight = grades.reduce((sum, g) => sum + g.gewicht, 0);
  if (!totalWeight) return null;
  const total = grades.reduce((sum, g) => sum + g.note * g.gewicht, 0);
  return total / totalWeight;
}

function subjectAverage(subjectId) {
  const grades = getSubjectGrades(subjectId);
  if (grades.length === 0) return null;
  return weightedAverage(grades);
}

function gradeColor(note) {
  if (note >= 5.5) return '#28c840';
  if (note >= 4.5) return '#34c759';
  if (note >= 4.0) return '#ffcc00';
  if (note >= 3.0) return '#ff9500';
  return '#ff3b30';
}

function fmt(n, digits = 2) {
  return (n === null || n === undefined || Number.isNaN(n)) ? '–' : n.toFixed(digits);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function parseDecimalInput(value) {
  return parseFloat(String(value).trim());
}

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function requiredGrade(subjectId, newWeight, targetIncrease) {
  const grades = getSubjectGrades(subjectId);
  const totalWeight = grades.reduce((s, g) => s + g.gewicht, 0);
  const sum = grades.reduce((s, g) => s + g.note * g.gewicht, 0);
  const currentAvg = totalWeight > 0 ? sum / totalWeight : null;
  const currentRounded = currentAvg !== null ? roundToHalf(currentAvg) : null;

  if (newWeight <= 0 || Number.isNaN(newWeight)) {
    return { error: 'Gewichtung muss grösser als 0 sein.' };
  }

  if (currentRounded === null) {
    return { value: 4.0, note: 'Erste Note: 4.0 ergibt direkt eine 4.0 als Basis.' };
  }

  const targetRounded = targetIncrease ? Math.min(6, currentRounded + 0.5) : currentRounded;

  if (targetIncrease && currentRounded >= 6) {
    return { value: 6.0, note: 'Das Maximum ist bereits erreicht.' };
  }

  const threshold = targetRounded - 0.25;
  const needed = (threshold * (totalWeight + newWeight) - sum) / newWeight;

  if (needed > 6) {
    return { error: 'Auch mit einer 6.0 kann dieses Ziel mit dieser Gewichtung nicht mehr erreicht werden.' };
  }
  if (needed <= 1) {
    return { value: 1.0, note: 'Ziel ist bereits mit der tiefsten Note gesichert.' };
  }
  return { value: round2(Math.min(6, Math.max(1, needed))) };
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

let zTop = 600;

function openWindow(id) {
  document.querySelectorAll('.window').forEach(w => w.classList.remove('open'));
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.add('open');
  win.style.zIndex = ++zTop;
}

function closeAllWindows() {
  document.querySelectorAll('.window').forEach(w => w.classList.remove('open'));
}

function makeDraggable(win) {
  const bar = win.querySelector('.window-titlebar');
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;

  bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('.tl')) return;
    dragging = true;
    const rect = win.getBoundingClientRect();
    win.style.left = rect.left + 'px';
    win.style.top = rect.top + 'px';
    win.style.transform = 'none';
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    win.style.zIndex = ++zTop;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    win.style.left = Math.max(0, e.clientX - offsetX) + 'px';
    win.style.top = Math.max(30, e.clientY - offsetY) + 'px';
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

document.querySelectorAll('.window').forEach(makeDraggable);
document.querySelectorAll('.window [data-close]').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.window').classList.remove('open'));
});
document.querySelectorAll('.dock-item').forEach(btn => {
  btn.addEventListener('click', () => {
    renderAll();
    openWindow(btn.dataset.window);
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllWindows();
});

function renderMenubarDate() {
  const el = document.getElementById('menubar-date');
  const now = new Date();
  el.textContent = now.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    '  ' + now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}
renderMenubarDate();
setInterval(renderMenubarDate, 30000);

function computeOverallAverage() {
  const relevantSubjects = state.subjects.filter(s => s.promotionswirksam);
  const entries = relevantSubjects.map(s => {
    const avg = subjectAverage(s.id);
    return { rounded: avg !== null ? roundToHalf(avg) : null };
  }).filter(e => e.rounded !== null);

  if (!entries.length) return null;

  let weightSum = 0;
  let valueSum = 0;
  entries.forEach(e => {
    const weight = e.rounded < 4.0 ? 2 : 1;
    weightSum += weight;
    valueSum += e.rounded * weight;
  });
  return valueSum / weightSum;
}

function renderOverallWidget() {
  const overall = computeOverallAverage();
  const el = document.getElementById('overall-average');
  el.textContent = overall !== null ? fmt(overall, 2) : '–';
  el.style.color = overall !== null ? gradeColor(overall) : '#fff';
}

function renderSubjectsOverview() {
  const body = document.getElementById('subjects-overview-body');
  body.innerHTML = '';
  if (!state.subjects.length) {
    body.innerHTML = '<tr><td colspan="5" style="opacity:.6">Noch keine Fächer vorhanden.</td></tr>';
    return;
  }

  state.subjects.forEach(s => {
    const grades = getSubjectGrades(s.id);
    const avg = subjectAverage(s.id);
    const rounded = avg !== null ? roundToHalf(avg) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a class="subject-link" data-subject="${s.id}">${escapeHtml(s.name)}</a></td>
      <td>${escapeHtml(s.kuerzel)}</td>
      <td>${fmt(avg)}</td>
      <td>${rounded !== null ? `<span class="grade-pill" style="background:${gradeColor(rounded)}">${fmt(rounded, 1)}</span>` : '–'}</td>
      <td>${grades.length}</td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('.subject-link').forEach(a => {
    a.addEventListener('click', () => openSubjectDetail(a.dataset.subject));
  });
}

const subjectForm = document.getElementById('subject-form');
const subjectNameInput = document.getElementById('subject-name');
const subjectKuerzelInput = document.getElementById('subject-kuerzel');
const subjectPromoInput = document.getElementById('subject-promo');
const subjectEditIdInput = document.getElementById('subject-edit-id');
const subjectSubmitBtn = document.getElementById('subject-submit-btn');
const subjectCancelBtn = document.getElementById('subject-cancel-edit');

subjectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = subjectNameInput.value.trim();
  const kuerzel = subjectKuerzelInput.value.trim().toUpperCase();
  const promo = subjectPromoInput.checked;
  const editId = subjectEditIdInput.value;

  if (!name) {
    showToast('Bitte einen Fachnamen eingeben.', 'error');
    return;
  }
  if (!/^[A-Z]{2}$/.test(kuerzel)) {
    showToast('Das Kürzel muss aus genau 2 Buchstaben bestehen.', 'error');
    return;
  }
  const duplicate = state.subjects.find(s => s.kuerzel === kuerzel && s.id !== editId);
  if (duplicate) {
    showToast(`Das Kürzel "${kuerzel}" wird bereits verwendet.`, 'error');
    return;
  }

  if (editId) {
    const subj = subjectById(editId);
    if (subj) {
      subj.name = name;
      subj.kuerzel = kuerzel;
      subj.promotionswirksam = promo;
    }
    showToast('Fach aktualisiert.', 'success');
  } else {
    state.subjects.push({ id: uid(), name, kuerzel, promotionswirksam: promo });
    showToast('Fach hinzugefügt.', 'success');
  }

  saveData();
  resetSubjectForm();
  renderAll();
});

function resetSubjectForm() {
  subjectForm.reset();
  subjectPromoInput.checked = true;
  subjectEditIdInput.value = '';
  subjectSubmitBtn.textContent = 'Fach hinzufügen';
  subjectCancelBtn.style.display = 'none';
}
subjectCancelBtn.addEventListener('click', resetSubjectForm);

function editSubject(id) {
  const s = subjectById(id);
  if (!s) return;
  subjectNameInput.value = s.name;
  subjectKuerzelInput.value = s.kuerzel;
  subjectPromoInput.checked = s.promotionswirksam;
  subjectEditIdInput.value = s.id;
  subjectSubmitBtn.textContent = 'Änderungen speichern';
  subjectCancelBtn.style.display = 'inline-block';
  openWindow('win-subjects');
}

function deleteSubject(id) {
  const s = subjectById(id);
  if (!s) return;
  const gradeCount = getSubjectGrades(id).length;
  const msg = gradeCount > 0
    ? `"${s.name}" löschen? ${gradeCount} zugehörige Note(n) werden ebenfalls entfernt.`
    : `"${s.name}" wirklich löschen?`;
  if (!confirm(msg)) return;
  state.subjects = state.subjects.filter(x => x.id !== id);
  state.grades = state.grades.filter(g => g.subjectId !== id);
  saveData();
  showToast('Fach gelöscht.', 'success');
  renderAll();
}

function renderSubjectsTable() {
  const body = document.getElementById('subjects-table-body');
  body.innerHTML = '';
  if (!state.subjects.length) {
    body.innerHTML = '<tr><td colspan="4" style="opacity:.6">Noch keine Fächer.</td></tr>';
    return;
  }
  state.subjects.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.kuerzel)}</td>
      <td>${s.promotionswirksam ? 'Ja' : 'Nein'}</td>
      <td>
        <button class="btn btn-secondary btn-small" data-edit="${s.id}">Bearbeiten</button>
        <button class="btn btn-danger btn-small" data-del="${s.id}">Löschen</button>
      </td>
    `;
    body.appendChild(tr);
  });
  body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editSubject(b.dataset.edit)));
  body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteSubject(b.dataset.del)));
}

const examTypeForm = document.getElementById('examtype-form');
const examTypeNameInput = document.getElementById('examtype-name');

examTypeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = examTypeNameInput.value.trim();
  if (!name) {
    showToast('Bitte eine Bezeichnung eingeben.', 'error');
    return;
  }
  if (state.examTypes.some(et => et.name.toLowerCase() === name.toLowerCase())) {
    showToast('Diese Prüfungsart existiert bereits.', 'error');
    return;
  }
  state.examTypes.push({ id: uid(), name });
  saveData();
  examTypeForm.reset();
  showToast('Prüfungsart hinzugefügt.', 'success');
  renderAll();
});

function deleteExamType(id) {
  const inUse = state.grades.some(g => g.examTypeId === id);
  if (inUse) {
    showToast('Diese Prüfungsart wird noch von Noten verwendet und kann nicht gelöscht werden.', 'error');
    return;
  }
  if (!confirm('Prüfungsart löschen?')) return;
  state.examTypes = state.examTypes.filter(et => et.id !== id);
  saveData();
  showToast('Prüfungsart gelöscht.', 'success');
  renderAll();
}

function renderExamTypesList() {
  const list = document.getElementById('examtypes-list');
  list.innerHTML = '';
  if (!state.examTypes.length) {
    list.innerHTML = '<li style="opacity:.6">Keine Prüfungsarten vorhanden.</li>';
    return;
  }
  state.examTypes.forEach(et => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(et.name)}</span><button class="btn btn-danger btn-small" data-del-et="${et.id}">Löschen</button>`;
    list.appendChild(li);
  });
  list.querySelectorAll('[data-del-et]').forEach(b => b.addEventListener('click', () => deleteExamType(b.dataset.delEt)));
}

const gradeForm = document.getElementById('grade-form');
const gradeEditIdInput = document.getElementById('grade-edit-id');
const gradeFachSelect = document.getElementById('grade-fach');
const gradeArtSelect = document.getElementById('grade-art');
const gradeNoteInput = document.getElementById('grade-note');
const gradeGewichtInput = document.getElementById('grade-gewicht');
const gradeDatumInput = document.getElementById('grade-datum');
const gradeSubmitBtn = document.getElementById('grade-submit-btn');
const gradeCancelBtn = document.getElementById('grade-cancel-edit');

function populateGradeFormDefaults() {
  gradeDatumInput.value = todayISO();
  gradeGewichtInput.value = '1';
}

function resetGradeForm() {
  gradeForm.reset();
  gradeEditIdInput.value = '';
  gradeSubmitBtn.textContent = 'Note speichern';
  gradeCancelBtn.style.display = 'none';
  populateGradeFormDefaults();
}
gradeCancelBtn.addEventListener('click', resetGradeForm);

function populateSelects() {
  gradeFachSelect.innerHTML = state.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.kuerzel)})</option>`).join('');
  gradeArtSelect.innerHTML = state.examTypes.map(et => `<option value="${et.id}">${escapeHtml(et.name)}</option>`).join('');
  document.getElementById('chart-subject-select').innerHTML = state.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.kuerzel)})</option>`).join('');
}

gradeForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!state.subjects.length) {
    showToast('Bitte zuerst ein Fach anlegen.', 'error');
    return;
  }
  if (!state.examTypes.length) {
    showToast('Bitte zuerst eine Prüfungsart anlegen.', 'error');
    return;
  }

  const subjectId = gradeFachSelect.value;
  const examTypeId = gradeArtSelect.value;
  const note = parseDecimalInput(gradeNoteInput.value);
  const gewicht = parseDecimalInput(gradeGewichtInput.value);
  const datum = gradeDatumInput.value;
  const editId = gradeEditIdInput.value;

  if (String(gradeNoteInput.value).includes(',')) {
    showToast('Bitte Dezimalstellen mit Punkt statt Komma eingeben.', 'error');
    return;
  }
  if (String(gradeGewichtInput.value).includes(',')) {
    showToast('Bitte bei der Gewichtung einen Punkt statt Komma verwenden.', 'error');
    return;
  }
  if (Number.isNaN(note) || note < 1 || note > 6) {
    showToast('Die Note muss zwischen 1.0 und 6.0 liegen.', 'error');
    return;
  }
  if (Number.isNaN(gewicht) || gewicht <= 0) {
    showToast('Die Gewichtung muss grösser als 0 sein.', 'error');
    return;
  }
  if (!datum) {
    showToast('Bitte ein Datum wählen.', 'error');
    return;
  }

  if (editId) {
    const grade = state.grades.find(g => g.id === editId);
    if (grade) {
      grade.subjectId = subjectId;
      grade.examTypeId = examTypeId;
      grade.note = round2(note);
      grade.gewicht = round2(gewicht);
      grade.datum = datum;
    }
    showToast('Note aktualisiert.', 'success');
  } else {
    state.grades.push({
      id: uid(),
      subjectId,
      examTypeId,
      note: round2(note),
      gewicht: round2(gewicht),
      datum
    });
    showToast('Note gespeichert.', 'success');
  }

  saveData();
  resetGradeForm();
  populateSelects();
  if (subjectId) gradeFachSelect.value = subjectId;
  renderAll();
});

function editGrade(id) {
  const grade = state.grades.find(g => g.id === id);
  if (!grade) return;
  gradeEditIdInput.value = grade.id;
  gradeFachSelect.value = grade.subjectId;
  gradeArtSelect.value = grade.examTypeId;
  gradeNoteInput.value = fmt(grade.note, 1);
  gradeGewichtInput.value = fmt(grade.gewicht, 1).replace(/\.0$/, '.0');
  gradeDatumInput.value = grade.datum;
  gradeSubmitBtn.textContent = 'Änderungen speichern';
  gradeCancelBtn.style.display = 'inline-block';
  openWindow('win-grades');
}

function deleteGrade(id) {
  if (!confirm('Diese Note wirklich löschen?')) return;
  state.grades = state.grades.filter(g => g.id !== id);
  saveData();
  showToast('Note gelöscht.', 'success');
  renderAll();
}

function renderGradesTable() {
  const body = document.getElementById('grades-table-body');
  body.innerHTML = '';
  const sorted = [...state.grades].sort((a, b) => b.datum.localeCompare(a.datum));
  if (!sorted.length) {
    body.innerHTML = '<tr><td colspan="6" style="opacity:.6">Noch keine Noten erfasst.</td></tr>';
    return;
  }
  sorted.forEach(g => {
    const subj = subjectById(g.subjectId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${subj ? escapeHtml(subj.kuerzel) : '?'}</td>
      <td>${escapeHtml(examTypeName(g.examTypeId))}</td>
      <td><span class="grade-pill" style="background:${gradeColor(g.note)}">${fmt(g.note, 1)}</span></td>
      <td>${fmt(g.gewicht, 1)}</td>
      <td>${g.datum}</td>
      <td>
        <button class="btn btn-secondary btn-small" data-edit-grade="${g.id}">Bearbeiten</button>
        <button class="btn btn-danger btn-small" data-del-grade="${g.id}">Löschen</button>
      </td>
    `;
    body.appendChild(tr);
  });
  body.querySelectorAll('[data-edit-grade]').forEach(b => b.addEventListener('click', () => editGrade(b.dataset.editGrade)));
  body.querySelectorAll('[data-del-grade]').forEach(b => b.addEventListener('click', () => deleteGrade(b.dataset.delGrade)));
}

function openSubjectDetail(subjectId) {
  const s = subjectById(subjectId);
  if (!s) return;
  document.getElementById('subject-detail-title').textContent = `${s.name} (${s.kuerzel})`;

  const grades = [...getSubjectGrades(subjectId)].sort((a, b) => a.datum.localeCompare(b.datum));
  const avg = subjectAverage(subjectId);
  const rounded = avg !== null ? roundToHalf(avg) : null;

  const body = document.getElementById('subject-detail-body');
  body.innerHTML = `
    <div class="detail-stats">
      <div class="stat-card"><div class="stat-label">Schnitt</div><div class="stat-value">${fmt(avg)}</div></div>
      <div class="stat-card"><div class="stat-label">Zeugnisnote</div><div class="stat-value" style="color:${rounded !== null ? gradeColor(rounded) : 'inherit'}">${fmt(rounded, 1)}</div></div>
      <div class="stat-card"><div class="stat-label">Anzahl Noten</div><div class="stat-value">${grades.length}</div></div>
      <div class="stat-card"><div class="stat-label">Promotionswirksam</div><div class="stat-value">${s.promotionswirksam ? 'Ja' : 'Nein'}</div></div>
    </div>

    <div class="need-box">
      <h4>Was brauche ich bei der nächsten Prüfung?</h4>
      <label style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
        Gewichtung der nächsten Prüfung:
        <input type="number" id="detail-weight-input" min="0.1" step="0.1" value="1" style="width:80px;">
      </label>
      <div class="need-row"><span>Um die Zeugnisnote ${fmt(rounded, 1)} zu halten:</span><strong id="need-same-val"></strong></div>
      <div class="need-row"><span>Um eine halbe Note besser zu werden:</span><strong id="need-better-val"></strong></div>
    </div>

    <h3 class="section-title">Alle Prüfungen</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Datum</th><th>Art</th><th>Note</th><th>Gewicht</th></tr></thead>
        <tbody>
          ${grades.length === 0 ? '<tr><td colspan="4" style="opacity:.6">Keine Prüfungen.</td></tr>' : grades.map(g => `
            <tr>
              <td>${g.datum}</td>
              <td>${escapeHtml(examTypeName(g.examTypeId))}</td>
              <td><span class="grade-pill" style="background:${gradeColor(g.note)}">${fmt(g.note, 1)}</span></td>
              <td>${fmt(g.gewicht, 1)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  function updateNeedDisplay() {
    const wInput = document.getElementById('detail-weight-input');
    const raw = wInput.value;
    if (raw.includes(',')) {
      document.getElementById('need-same-val').textContent = 'Bitte Punkt statt Komma verwenden.';
      document.getElementById('need-better-val').textContent = 'Bitte Punkt statt Komma verwenden.';
      return;
    }
    const w = parseDecimalInput(raw);
    const same = requiredGrade(subjectId, w, false);
    const better = requiredGrade(subjectId, w, true);
    document.getElementById('need-same-val').textContent = same.error ? same.error : (same.note || fmt(same.value, 1));
    document.getElementById('need-better-val').textContent = better.error ? better.error : (better.note || fmt(better.value, 1));
  }
  document.getElementById('detail-weight-input').addEventListener('input', updateNeedDisplay);
  updateNeedDisplay();
  openWindow('win-subject-detail');
}

document.getElementById('export-btn').addEventListener('click', () => {
  try {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notenverwaltung-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Backup wurde exportiert.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Export fehlgeschlagen.', 'error');
  }
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!imported || !Array.isArray(imported.subjects) || !Array.isArray(imported.examTypes) || !Array.isArray(imported.grades)) {
        throw new Error('Das Backup hat nicht das erwartete Format.');
      }
      if (!confirm('Import wird alle aktuellen Daten überschreiben. Fortfahren?')) return;
      state = imported;
      saveData();
      resetSubjectForm();
      resetGradeForm();
      showToast('Backup erfolgreich importiert.', 'success');
      renderAll();
    } catch (err) {
      console.error(err);
      showToast('Import fehlgeschlagen: Datei ist kein gültiges Backup.', 'error');
    } finally {
      e.target.value = '';
    }
  };
  reader.onerror = () => showToast('Datei konnte nicht gelesen werden.', 'error');
  reader.readAsText(file);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('Wirklich ALLE Daten unwiderruflich löschen?')) return;
  state = defaultData();
  saveData();
  resetSubjectForm();
  resetGradeForm();
  showToast('Alle Daten wurden gelöscht.', 'success');
  renderAll();
});

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawAxes(ctx, canvas, padding) {
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, canvas.height - padding.bottom);
  ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
  ctx.stroke();
}

function drawYGrid(ctx, canvas, padding, minY = 1, maxY = 6) {
  const h = canvas.height - padding.top - padding.bottom;
  const toY = (v) => padding.top + h - ((v - minY) / (maxY - minY)) * h;
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let v = minY; v <= maxY; v++) {
    const y = toY(v);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(canvas.width - padding.right, y);
    ctx.stroke();
    ctx.fillText(v.toFixed(0), 8, y + 4);
  }
}

function subjectPalette(index) {
  const colors = ['#0a84ff', '#ff4f81', '#23b26d', '#7a4fe0', '#ff8c42', '#00a6c7', '#d97706', '#e11d48'];
  return colors[index % colors.length];
}

function renderAllSubjectsChart() {
  const canvas = document.getElementById('chart-all-subjects');
  const ctx = canvas.getContext('2d');
  const legend = document.getElementById('chart-all-legend');
  clearCanvas(ctx, canvas);
  legend.innerHTML = '';

  const padding = { left: 40, right: 20, top: 20, bottom: 30 };
  drawAxes(ctx, canvas, padding);
  drawYGrid(ctx, canvas, padding);

  const subjectsWithGrades = state.subjects
    .map((s, index) => ({
      subject: s,
      index,
      grades: [...getSubjectGrades(s.id)].sort((a, b) => a.datum.localeCompare(b.datum))
    }))
    .filter(entry => entry.grades.length > 0);

  if (!subjectsWithGrades.length) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '13px sans-serif';
    ctx.fillText('Noch keine Noten vorhanden.', padding.left + 10, canvas.height / 2);
    return;
  }

  const maxPoints = Math.max(...subjectsWithGrades.map(entry => entry.grades.length));
  const w = canvas.width - padding.left - padding.right;
  const h = canvas.height - padding.top - padding.bottom;
  const toX = (i, len) => padding.left + (len === 1 ? w / 2 : (i / (len - 1)) * w);
  const toY = (v) => padding.top + h - ((v - 1) / 5) * h;

  subjectsWithGrades.forEach((entry, colorIndex) => {
    const color = subjectPalette(colorIndex);
    const { subject, grades } = entry;

    const legendItem = document.createElement('span');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `<span class="legend-dot" style="background:${color}"></span>${escapeHtml(subject.kuerzel)} – ${escapeHtml(subject.name)}`;
    legend.appendChild(legendItem);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    grades.forEach((g, i) => {
      const x = toX(i, grades.length);
      const y = toY(g.note);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    grades.forEach((g, i) => {
      const x = toX(i, grades.length);
      const y = toY(g.note);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function renderHistoryChart() {
  const canvas = document.getElementById('chart-history');
  const ctx = canvas.getContext('2d');
  clearCanvas(ctx, canvas);
  const subjectId = document.getElementById('chart-subject-select').value;
  if (!subjectId) return;

  const grades = [...getSubjectGrades(subjectId)].sort((a, b) => a.datum.localeCompare(b.datum));
  const padding = { left: 40, right: 20, top: 20, bottom: 30 };
  drawAxes(ctx, canvas, padding);
  drawYGrid(ctx, canvas, padding);

  if (!grades.length) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '13px sans-serif';
    ctx.fillText('Keine Noten für dieses Fach.', padding.left + 10, canvas.height / 2);
    return;
  }

  const w = canvas.width - padding.left - padding.right;
  const h = canvas.height - padding.top - padding.bottom;
  const toX = (i) => padding.left + (grades.length === 1 ? w / 2 : (i / (grades.length - 1)) * w);
  const toY = (v) => padding.top + h - ((v - 1) / 5) * h;

  ctx.strokeStyle = '#0a84ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  grades.forEach((g, i) => {
    const x = toX(i);
    const y = toY(g.note);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  grades.forEach((g, i) => {
    const x = toX(i);
    const y = toY(g.note);
    ctx.fillStyle = gradeColor(g.note);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fmt(g.note, 1), x, y - 10);
  });
  ctx.textAlign = 'left';
}

document.getElementById('chart-subject-select').addEventListener('change', renderHistoryChart);

function renderCharts() {
  renderAllSubjectsChart();
  renderHistoryChart();
}

function renderAll() {
  populateSelects();
  renderOverallWidget();
  renderSubjectsOverview();
  renderSubjectsTable();
  renderExamTypesList();
  renderGradesTable();
  renderCharts();
}

populateGradeFormDefaults();
renderAll();

const STORAGE_KEY = "todolist.tasks.v1";
const THEME_KEY = "todolist.theme.v1";
const NOTIFIED_KEY = "todolist.dueNotified.v1";
const GAMIFICATION_KEY = "todolist.gamification.v1";

/**
 * @typedef {"Pekerjaan"|"Kuliah"|"Hobby"} Label
 * @typedef {"high"|"medium"|"low"} Priority
 * @typedef {{ id: string, text: string, label: Label, priority: Priority, dueAt: (number|null), completed: boolean, createdAt: number, completedAt: (number|null) }} Task
 */

function loadGamification() {
  const defaultGamification = { level: 1, xp: 0, streak: 0, lastStreakDate: null };
  try {
    const raw = localStorage.getItem(GAMIFICATION_KEY);
    return raw ? { ...defaultGamification, ...JSON.parse(raw) } : defaultGamification;
  } catch {
    return defaultGamification;
  }
}

function saveGamification(g) {
  localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(g));
}

let gamification = loadGamification();
const LEVEL_UP_XP = 100;

function checkStreakReset() {
  if (!gamification.lastStreakDate) return;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  
  if (gamification.lastStreakDate !== todayStr && gamification.lastStreakDate !== yesterday) {
    gamification.streak = 0;
    saveGamification(gamification);
  }
}
// Check on load
checkStreakReset();

function addXPForTask(task) {
  const xpMap = { high: 50, medium: 30, low: 10 };
  gamification.xp += xpMap[task.priority] || 10;
  
  const todayStr = new Date().toISOString().split('T')[0];
  if (gamification.lastStreakDate !== todayStr) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (gamification.lastStreakDate === yesterday || !gamification.lastStreakDate) {
      gamification.streak += 1;
    } else {
      gamification.streak = 1;
    }
    gamification.lastStreakDate = todayStr;
  }
  
  // Level up logic
  let requiredXP = gamification.level * LEVEL_UP_XP;
  while (gamification.xp >= requiredXP) {
    gamification.xp -= requiredXP;
    gamification.level += 1;
    requiredXP = gamification.level * LEVEL_UP_XP;
  }
  
  saveGamification(gamification);
  render();
}

/** @returns {Task[]} */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        id: typeof t.id === "string" ? t.id : cryptoId(),
        text: typeof t.text === "string" ? t.text : "",
        label: normalizeLabel(t.label),
        priority: normalizePriority(t.priority),
        dueAt: normalizeDueAt(t.dueAt),
        completed: Boolean(t.completed),
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        completedAt:
          typeof t.completedAt === "number" ? t.completedAt : t.completed ? Date.now() : null,
      }))
      .filter((t) => t.text.trim().length > 0);
  } catch {
    return [];
  }
}

/** @param {Task[]} tasks */
function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadNotifiedSet() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/** @param {Set<string>} set */
function saveNotifiedSet(set) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]));
}

function cryptoId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

/** @param {string} text */
function sanitizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

/** @param {Task[]} tasks */
function countActive(tasks) {
  return tasks.reduce((acc, t) => acc + (t.completed ? 0 : 1), 0);
}

/** @param {unknown} v @returns {Label} */
function normalizeLabel(v) {
  return v === "Kuliah" || v === "Hobby" || v === "Pekerjaan" ? v : "Pekerjaan";
}

/** @param {unknown} v @returns {Priority} */
function normalizePriority(v) {
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

/** @param {unknown} v @returns {number|null} */
function normalizeDueAt(v) {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  return v;
}

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: #${id}`);
  return node;
}

const form = /** @type {HTMLFormElement} */ (el("todoForm"));
const input = /** @type {HTMLInputElement} */ (el("todoInput"));
const labelSelect = /** @type {HTMLSelectElement} */ (el("todoLabel"));
const prioritySelect = /** @type {HTMLSelectElement} */ (el("todoPriority"));
const dueInput = /** @type {HTMLInputElement} */ (el("todoDue"));
const list = /** @type {HTMLUListElement} */ (el("todoList"));
const countLeftEl = el("countLeft");
const progressTextEl = el("progressText");
const emptyState = el("emptyState");
const clearDoneBtn = /** @type {HTMLButtonElement} */ (el("clearDoneBtn"));
const searchInput = /** @type {HTMLInputElement} */ (el("searchInput"));
const themeToggle = /** @type {HTMLButtonElement} */ (el("themeToggle"));
const themeLabel = el("themeLabel");
const sortSelect = /** @type {HTMLSelectElement} */ (document.getElementById("sortSelect"));

const filterBtns = /** @type {NodeListOf<HTMLButtonElement>} */ (
  document.querySelectorAll("[data-filter]")
);

/** @type {Task[]} */
let tasks = loadTasks();
let searchQuery = "";
/** @type {"all"|"active"|"done"} */
let statusFilter = "all";

let notified = loadNotifiedSet();

function loadThemePreference() {
  const raw = localStorage.getItem(THEME_KEY);
  if (raw === "light" || raw === "dark") return raw;
  return null;
}

/** @param {"light"|"dark"} theme */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeLabel.textContent = theme === "dark" ? "Dark" : "Light";
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const pref = loadThemePreference();
  if (pref) {
    applyTheme(pref);
    return;
  }
  const systemDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(systemDark ? "dark" : "light");
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDue(dueAt) {
  if (!dueAt) return "";
  const d = new Date(dueAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

/** @param {Priority} p */
function priorityRank(p) {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

/** @param {Task} t */
function isDueSoon(t) {
  if (t.completed) return false;
  if (!t.dueAt) return false;
  const now = Date.now();
  const diff = t.dueAt - now;
  return diff > 0 && diff <= 60 * 60 * 1000;
}

function checkDueNotifications() {
  const dueSoon = tasks.filter((t) => isDueSoon(t));
  if (dueSoon.length === 0) return;

  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  if (Notification.permission !== "granted") return;

  let changed = false;
  for (const t of dueSoon) {
    if (notified.has(t.id)) continue;
    notified.add(t.id);
    changed = true;
    try {
      new Notification("Deadline mendekat", {
        body: `${t.text} (${formatDue(t.dueAt)})`,
      });
    } catch {
      // ignore
    }
  }
  if (changed) saveNotifiedSet(notified);
}

function renderGamification() {
  const levelText = document.getElementById("levelText");
  const streakText = document.getElementById("streakText");
  const xpBar = document.getElementById("xpBar");

  if (levelText && streakText && xpBar) {
    levelText.textContent = `Level ${gamification.level}`;
    streakText.textContent = `${gamification.streak} 🔥`;
    const requiredXP = gamification.level * LEVEL_UP_XP;
    const progress = (gamification.xp / requiredXP) * 100;
    xpBar.style.width = `${Math.min(progress, 100)}%`;
  }
}

function render() {
  renderGamification();
  
  const activeCount = countActive(tasks);
  countLeftEl.textContent =
    activeCount === 0 ? "Semua selesai" : `${activeCount} belum selesai`;

  const now = new Date();
  const createdToday = tasks.filter((t) => isSameLocalDay(new Date(t.createdAt), now));
  const doneToday = tasks.filter(
    (t) => t.completedAt && isSameLocalDay(new Date(t.completedAt), now)
  );
  progressTextEl.textContent = `Kamu sudah menyelesaikan ${doneToday.length} dari ${createdToday.length} tugas hari ini!`;

  const visible = getVisibleTasks();

  emptyState.hidden = visible.length !== 0;
  clearDoneBtn.disabled = tasks.every((t) => !t.completed);
  clearDoneBtn.style.opacity = clearDoneBtn.disabled ? "0.55" : "1";
  clearDoneBtn.style.pointerEvents = clearDoneBtn.disabled ? "none" : "auto";

  const sortMethod = sortSelect ? sortSelect.value : "default";

  list.innerHTML = visible
    .slice()
    .sort((a, b) => {
      if (sortMethod === "newest") return b.createdAt - a.createdAt;
      if (sortMethod === "oldest") return a.createdAt - b.createdAt;
      if (sortMethod === "deadline") {
         if (a.dueAt && !b.dueAt) return -1;
         if (!a.dueAt && b.dueAt) return 1;
         if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
         return a.createdAt - b.createdAt;
      }
      // default: priority
      const pr = priorityRank(a.priority) - priorityRank(b.priority);
      if (pr !== 0) return pr; // high first
      if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      if (a.dueAt && !b.dueAt) return -1;
      if (!a.dueAt && b.dueAt) return 1;
      return b.createdAt - a.createdAt;
    })
    .map((t) => itemTemplate(t))
    .join("");

  checkDueNotifications();
}

function getVisibleTasks() {
  const q = sanitizeText(searchQuery).toLowerCase();
  return tasks.filter((t) => {
    if (statusFilter === "active" && t.completed) return false;
    if (statusFilter === "done" && !t.completed) return false;
    if (!q) return true;
    const hay = `${t.text} ${t.label}`.toLowerCase();
    return hay.includes(q);
  });
}

/** @param {Task} task */
function itemTemplate(task) {
  const checked = task.completed ? "true" : "false";
  const safeText = escapeHtml(task.text);
  const prioClass =
    task.priority === "high"
      ? "badge--prio-high"
      : task.priority === "medium"
        ? "badge--prio-medium"
        : "badge--prio-low";
  const prioText =
    task.priority === "high"
      ? "Tinggi"
      : task.priority === "medium"
        ? "Sedang"
        : "Rendah";
  const dueLabel = task.dueAt ? formatDue(task.dueAt) : "";
  const urgent = isDueSoon(task);

  return `
    <li class="item" data-id="${task.id}" data-completed="${checked}">
      <label class="check" title="Tandai selesai / belum">
        <input class="check__input" type="checkbox" ${task.completed ? "checked" : ""} />
        <span class="check__box" aria-hidden="true"></span>
      </label>
      <div class="text ${urgent ? "is-urgent" : ""}">
        ${safeText}
        <div class="badges" aria-hidden="true">
          <span class="badge badge--label">${escapeHtml(task.label)}</span>
          <span class="badge ${prioClass}">Prioritas: ${prioText}</span>
          ${
            dueLabel
              ? `<span class="badge badge--due">${urgent ? "Deadline < 1 jam: " : "Deadline: "}${escapeHtml(dueLabel)}</span>`
              : ""
          }
        </div>
      </div>
      <div class="actions">
        <button class="iconBtn" type="button" data-action="edit" title="Edit tugas" aria-label="Edit">
          ✎
        </button>
        <button class="iconBtn" type="button" data-action="delete" title="Hapus tugas" aria-label="Hapus">
          ✕
        </button>
      </div>
    </li>
  `;
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = sanitizeText(input.value);
  if (!text) return;

  const dueAt = dueInput.value ? new Date(dueInput.value).getTime() : null;

  const task = /** @type {Task} */ ({
    id: cryptoId(),
    text,
    label: normalizeLabel(labelSelect.value),
    priority: normalizePriority(prioritySelect.value),
    dueAt: dueAt && Number.isFinite(dueAt) ? dueAt : null,
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
  });

  tasks.push(task);
  saveTasks(tasks);
  render();

  form.reset();
  labelSelect.value = "Pekerjaan";
  prioritySelect.value = "medium";
  input.focus();
});

if (sortSelect) {
  sortSelect.addEventListener("change", render);
}

list.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  const item = target.closest(".item");
  if (!item) return;
  const id = item.getAttribute("data-id");
  if (!id) return;

  const actionBtn = target.closest("[data-action]");
  if (actionBtn) {
    const action = actionBtn.getAttribute("data-action");
    if (action === "delete") {
      notified.delete(id);
      saveNotifiedSet(notified);
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks(tasks);
      render();
    } else if (action === "edit") {
      const taskToEdit = tasks.find(t => t.id === id);
      if (!taskToEdit) return;
      const newText = prompt("Ubah teks tugas:", taskToEdit.text);
      if (newText !== null && newText.trim() !== "") {
         taskToEdit.text = sanitizeText(newText);
         saveTasks(tasks);
         render();
      }
    }
    return;
  }

  const isCheck =
    target.classList.contains("check") ||
    target.classList.contains("check__box") ||
    target.classList.contains("check__input");
  if (!isCheck) return;

  tasks = tasks.map((t) => {
    if (t.id !== id) return t;
    const nextCompleted = !t.completed;
    if (nextCompleted) {
      addXPForTask(t);
      return { ...t, completed: true, completedAt: Date.now() };
    }
    notified.delete(id);
    saveNotifiedSet(notified);
    return { ...t, completed: false, completedAt: null };
  });
  saveTasks(tasks);
  render();
});

clearDoneBtn.addEventListener("click", () => {
  const toRemove = new Set(tasks.filter((t) => t.completed).map((t) => t.id));
  for (const id of toRemove) notified.delete(id);
  saveNotifiedSet(notified);
  tasks = tasks.filter((t) => !t.completed);
  saveTasks(tasks);
  render();
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value || "";
  render();
});

for (const btn of filterBtns) {
  btn.addEventListener("click", () => {
    const next = btn.getAttribute("data-filter");
    if (next !== "all" && next !== "active" && next !== "done") return;
    statusFilter = next;
    for (const b of filterBtns) b.classList.toggle("is-active", b === btn);
    render();
  });
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// FEATURE: Roulette
const rouletteBtn = document.getElementById("rouletteBtn");
if (rouletteBtn) {
  rouletteBtn.addEventListener("click", () => {
    const activeTasks = getVisibleTasks().filter(t => !t.completed);
    if (activeTasks.length === 0) return alert("Belum ada tugas aktif untuk dipilih! Tambahkan tugas baru dulu.");
    
    // Select strictly visible uncompleted items in the DOM
    const itemNodes = Array.from(document.querySelectorAll(".item[data-completed='false']"));
    if (itemNodes.length === 0) return;

    let count = 0;
    const maxSpins = 15 + Math.floor(Math.random() * 10);
    let speed = 50;
    let currentIndex = 0;

    // Disabled to prevent double-click
    rouletteBtn.style.pointerEvents = "none";
    rouletteBtn.style.opacity = "0.5";

    function spin() {
      itemNodes.forEach(el => el.classList.remove("is-roulette-active", "is-roulette-winner"));
      itemNodes[currentIndex].classList.add("is-roulette-active");
      
      currentIndex = (currentIndex + 1) % itemNodes.length;
      count++;
      
      if (count < maxSpins) {
        speed += 12; // slow down progressively
        setTimeout(spin, speed);
      } else {
        // winner
        const winnerIndex = (currentIndex - 1 + itemNodes.length) % itemNodes.length;
        itemNodes.forEach(el => el.classList.remove("is-roulette-active"));
        itemNodes[winnerIndex].classList.add("is-roulette-winner");
        
        // Remove winner styling after a few seconds
        setTimeout(() => {
          itemNodes[winnerIndex].classList.remove("is-roulette-winner");
          rouletteBtn.style.pointerEvents = "auto";
          rouletteBtn.style.opacity = "1";
        }, 4000);
      }
    }
    spin();
  });
}

// FEATURE: Export/Import Data
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const data = JSON.stringify({ tasks, gamification });
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `todolist_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

if (importBtn && importInput) {
  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          tasks = parsed.tasks;
          saveTasks(tasks);
        }
        if (parsed.gamification) {
          gamification = parsed.gamification;
          saveGamification(gamification);
        }
        render();
        alert("Data berhasil diimport & direstorasi!");
      } catch (err) {
        alert("File JSON tidak valid atau rusak.");
      }
      e.target.value = ""; // reset input
    };
    reader.readAsText(file);
  });
}

// First paint
initTheme();
render();

// Re-check deadlines periodically (color + notification)
setInterval(() => {
  render();
}, 60 * 1000);

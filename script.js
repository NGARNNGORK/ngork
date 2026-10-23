
  import { auth, db } from "./firebase-config.js";
  import {
    collection,
    getDocs,
    setDoc,
    doc,
    deleteDoc
  } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

  let STORAGE_KEY = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  let tasks = [];
  let userReady = false;
  let activeView = "dashboard";
  let toastTimer;



  function loadTasks() {
    if (!STORAGE_KEY) return [];

    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.error("โหลดรายการงานไม่สำเร็จ:", error);
      return [];
    }
  }

  async function saveTasks() {
    if (!userReady || !STORAGE_KEY || !auth.currentUser) return;

    // เก็บข้อมูลในเครื่องไว้เป็นข้อมูลสำรอง
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

    const uid = auth.currentUser.uid;

    try {
      await Promise.all(
        tasks.map(task =>
          setDoc(
            doc(db, "users", uid, "tasks", task.id),
            task
          )
        )
      );
    } catch (error) {
      console.error("บันทึกงานลง Firestore ไม่สำเร็จ:", error);
      showToast("บันทึกออนไลน์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต");
    }
  }

  async function initializeUserTasks(uid) {
    if (!uid) return;

    userReady = false;
    STORAGE_KEY = `ngork_tasks_v1_${uid}`;

    // โหลดงานเดิมจากเครื่องก่อน
    const localTasks = loadTasks();
    tasks = localTasks;
    render();

    try {
      const tasksRef = collection(db, "users", uid, "tasks");
      const snapshot = await getDocs(tasksRef);

      if (snapshot.empty) {
        // ถ้าบัญชีนี้ยังไม่มีงานออนไลน์ ให้นำงานเดิมขึ้นไปเก็บ
        tasks = localTasks;

        if (localTasks.length > 0) {
          await Promise.all(
            localTasks.map(task =>
              setDoc(
                doc(db, "users", uid, "tasks", task.id),
                task
              )
            )
          );
        }
      } else {
        // ถ้ามีงานออนไลน์แล้ว ให้ใช้ข้อมูลออนไลน์เป็นหลัก
        tasks = snapshot.docs.map(item => ({
          ...item.data(),
          id: item.id
        }));

        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      }
    } catch (error) {
      console.error("โหลดงานจาก Firestore ไม่สำเร็จ:", error);
      tasks = localTasks;
      showToast("โหลดงานออนไลน์ไม่สำเร็จ กำลังแสดงข้อมูลงานในเครื่อง");
    }

    userReady = true;
    render();
  }



  function localDate(date = new Date()) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }
  function prettyDate(dateString) {
    if (!dateString) return "ไม่ระบุวัน";
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  }
  function daysUntil(dateString) {
    const today = new Date(localDate() + "T00:00:00");
    const target = new Date(dateString + "T00:00:00");
    return Math.round((target - today) / 86400000);
  }
  function statusOf(task) {
    if (task.done) return "done";
    return daysUntil(task.date) < 0 ? "overdue" : "pending";
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
  }
  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }
  function taskDueText(task) {
    if (task.done) return "เสร็จเรียบร้อย";
    const diff = daysUntil(task.date);
    if (diff < 0) return `เลยกำหนด ${Math.abs(diff)} วัน`;
    if (diff === 0) return "ครบกำหนดวันนี้";
    if (diff === 1) return "ครบกำหนดพรุ่งนี้";
    return `อีก ${diff} วัน`;
  }
  function sortedTasks(list) {
    const mode = $("#sort-filter").value;
    return [...list].sort((a, b) => {
      if (mode === "newest") return b.createdAt - a.createdAt;
      if (mode === "title") return a.title.localeCompare(b.title, "th");
      return a.date.localeCompare(b.date) || b.createdAt - a.createdAt;
    });
  }
  function getVisibleTasks() {
    const query = $("#search-input").value.trim().toLowerCase();
    const filter = $("#status-filter").value;
    let list = tasks.filter(task => `${task.title} ${task.subject || ""} ${task.note || ""}`.toLowerCase().includes(query));
    if (filter !== "all") list = list.filter(task => statusOf(task) === filter);
    if (activeView === "upcoming") list = list.filter(task => !task.done && daysUntil(task.date) >= 0);
    if (activeView === "tasks") return sortedTasks(list);
    return sortedTasks(list);
  }
  function renderStats() {
    const done = tasks.filter(t => t.done).length;
    const pending = tasks.filter(t => !t.done && statusOf(t) === "pending").length;
    const overdue = tasks.filter(t => statusOf(t) === "overdue").length;
    const total = tasks.length;
    const percent = total ? Math.round(done / total * 100) : 0;
    $("#total-stat").textContent = total;
    $("#pending-stat").textContent = pending;
    $("#done-stat").textContent = done;
    $("#overdue-stat").textContent = overdue;
    $("#nav-task-count").textContent = tasks.filter(t => !t.done).length;
    $("#progress-number").textContent = `${percent}%`;
    $("#progress-ring").style.background = `conic-gradient(var(--purple) ${percent}%, #eeeafc ${percent}%)`;
    $("#progress-fill").style.width = `${percent}%`;
    $("#legend-done").textContent = done;
    $("#legend-pending").textContent = total - done;
    $("#progress-title").textContent = total === 0 ? "เริ่มต้นจากงานแรกกัน!" : percent === 100 ? "ยอดเยี่ยม! คุณทำครบทุกงานแล้ว" : "ทุกก้าวคือความคืบหน้า";
    $("#progress-copy").textContent = total === 0 ? "เพิ่มงานที่ต้องทำ แล้วติดตามความคืบหน้าได้ที่นี่" : `คุณทำงานสำเร็จแล้ว ${done} จาก ${total} งาน`;
  }


  function getSmartPriority(task) {
    if (task.done) {
      return {
        level: "done",
        label: "เสร็จแล้ว",
        score: -1,
        reason: "ทำงานนี้เสร็จเรียบร้อยแล้ว"
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(`${task.date}T00:00:00`);

    if (Number.isNaN(dueDate.getTime())) {
      return {
        level: "normal",
        label: "ตรวจสอบวันส่ง",
        score: 10,
        reason: "กรุณาตรวจสอบวันครบกำหนดของงานนี้"
      };
    }

    const daysLeft = Math.round(
      (dueDate.getTime() - today.getTime()) / 86400000
    );

    if (daysLeft < 0) {
      return {
        level: "urgent",
        label: "เลยกำหนด",
        score: 100,
        reason: "งานนี้เลยวันครบกำหนดแล้ว ควรตรวจสอบก่อน"
      };
    }

    if (daysLeft === 0) {
      return {
        level: "urgent",
        label: "ส่งวันนี้",
        score: 90,
        reason: "งานนี้ครบกำหนดวันนี้"
      };
    }

    if (daysLeft <= 2) {
      return {
        level: "high",
        label: "เร่งด่วน",
        score: 70,
        reason: `เหลือเวลาอีก ${daysLeft} วันก่อนส่ง`
      };
    }

    if (daysLeft <= 5) {
      return {
        level: "medium",
        label: "ควรเริ่มทำ",
        score: 40,
        reason: `ควรเริ่มทำไว้ก่อน เหลือ ${daysLeft} วัน`
      };
    }

    return {
      level: "normal",
      label: "รอได้",
      score: 10,
      reason: `ยังมีเวลาอีก ${daysLeft} วัน`
    };
  }



  function renderFocus() {
    const list = tasks
      .filter(task => !task.done)
      .sort((a, b) => {
        const priorityA = getSmartPriority(a).score;
        const priorityB = getSmartPriority(b).score;

        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }

        return a.date.localeCompare(b.date);
      })
      .slice(0, 4);

    const root = $("#focus-list");

    if (!list.length) {
      root.innerHTML = `
        <div class="empty-state">
          <span>✦</span>
          <strong>${tasks.length ? "ไม่มีงานค้างแล้ว เยี่ยมมาก!" : "ยังไม่มีงานในรายการ"}</strong>
          <p>${tasks.length ? "พักสักหน่อย แล้วค่อยเริ่มงานใหม่" : "เพิ่มงานแรกของคุณได้เลย"}</p>
        </div>`;
      return;
    }

    root.innerHTML = list.map(task => {
      const priority = getSmartPriority(task);

      return `
        <div class="focus-row">
          <input
            class="task-check"
            type="checkbox"
            data-toggle="${task.id}"
            aria-label="ทำ ${escapeHTML(task.title)} ให้เสร็จ"
          >
          <div class="focus-name">
            <strong>${escapeHTML(task.title)}</strong>
            <small>
              ${escapeHTML(task.subject || "งานทั่วไป")} · ${prettyDate(task.date)}
            </small>
            <small>${escapeHTML(priority.reason)}</small>
          </div>
          <span class="date-chip">${escapeHTML(priority.label)}</span>
        </div>`;
    }).join("");
  }

  function renderList() {
    const root = $("#task-list");
    const list = getVisibleTasks();
    if (!list.length) {
      root.innerHTML = `<div class="empty-state"><span>⌕</span><strong>${tasks.length ? "ไม่พบงานที่ตรงกับตัวกรอง" : "ยังไม่มีงานให้แสดง"}</strong><p>${tasks.length ? "ลองเปลี่ยนคำค้นหาหรือสถานะ" : "กด “เพิ่มงานใหม่” เพื่อเริ่มต้น"}</p></div>`;
    } else {
      root.innerHTML = list.map(task => {
        const status = statusOf(task);
        const statusLabel = status === "done" ? "เสร็จแล้ว" : status === "overdue" ? "เลยกำหนด" : "ยังไม่เสร็จ";
        return `<div class="task-row ${task.done ? "is-done" : ""}">
          <div class="task-main"><input class="task-check" type="checkbox" data-toggle="${task.id}" ${task.done ? "checked" : ""} aria-label="เปลี่ยนสถานะ ${escapeHTML(task.title)}"><div class="task-main-text"><strong title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</strong><small>${escapeHTML(task.subject || "งานทั่วไป")}${task.note ? " · " + escapeHTML(task.note) : ""}</small></div></div>
          <div class="due-date">${prettyDate(task.date)}</div>
          <span class="status-pill ${status}">${statusLabel}</span>
          <div class="row-actions"><button class="icon-btn" data-edit="${task.id}" title="แก้ไข" aria-label="แก้ไข">✎</button><button class="icon-btn delete" data-delete="${task.id}" title="ลบ" aria-label="ลบ">⌫</button></div>
        </div>`;
      }).join("");
    }
    $("#list-footer").textContent = `แสดงงาน ${list.length} จากทั้งหมด ${tasks.length} รายการ`;
  }
  function render() {
    if (!userReady) return;

    renderStats();
    renderFocus();
    renderList();
  }

  function setView(view) {
    activeView = view;

    const titles = {
      dashboard: "ภาพรวม",
      tasks: "งานทั้งหมด",
      upcoming: "ใกล้ถึงกำหนด"
    };

    // เปลี่ยนหัวข้อด้านบน
    $("#breadcrumb-current").textContent = titles[view];

    // เลือกส่วนที่จะแสดงในแต่ละเมนู
    const statsGrid = document.querySelector(".stats-grid");
    const contentGrid = document.querySelector(".content-grid");
    const tasksPanel = document.querySelector(".tasks-panel");

    if (view === "dashboard") {
    statsGrid.style.display = "";
    contentGrid.style.display = "";
    tasksPanel.style.display = "none";

  const accountName =
    document.getElementById("popover-name")?.textContent?.trim();

  $("#greeting").textContent =
    `สวัสดี, ${
      accountName && accountName !== "พื้นที่ของฉัน"
        ? accountName
        : "นักเรียน"
    } ✦`;

  $("#greeting").textContent = `สวัสดี, ${accountName} ✦`;
  } else {
    statsGrid.style.display = "none";
    contentGrid.style.display = "none";
    tasksPanel.style.display = "";

    $("#list-title").textContent =
      view === "upcoming"
        ? "งานที่ใกล้ถึงกำหนด"
        : "งานทั้งหมดของฉัน";

    $("#greeting").textContent =
      view === "upcoming"
        ? "เตรียมตัวก่อนถึงกำหนด"
        : "จัดการงานทั้งหมดของฉัน";
  }

    // อัปเดตเมนูที่ถูกเลือก
    $$(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    // รีเซ็ตตัวกรองสถานะ
    $("#status-filter").value = "all";

    // ปิดเมนูมือถือ
    $("#sidebar").classList.remove("open");

    // วาดรายการงานใหม่
    renderList();
  }

  function openModal(task = null) {
    $("#task-form").reset();
    $("#task-date").value = localDate();
    $("#task-form").dataset.editId = task ? task.id : "";
    $("#modal-title").textContent = task ? "แก้ไขงาน" : "เพิ่มงานใหม่";
    $("#task-title").value = task?.title || "";
    $("#task-date").value = task?.date || localDate();
    $("#task-subject").value = task?.subject || "";
    $("#task-note").value = task?.note || "";
    $("#modal-backdrop").hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#task-title").focus(), 30);
  }
  function closeModal() {
    $("#modal-backdrop").hidden = true;
    document.body.style.overflow = "";
  }
  function toggleTask(id, checked) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.done = checked;
    task.updatedAt = Date.now();
    saveTasks();
    render();
    showToast(checked ? "ทำเครื่องหมายว่าเสร็จแล้ว ✓" : "ย้ายกลับไปงานที่ยังไม่เสร็จ");
  }

  async function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!confirm(`ต้องการลบงาน “${task.title}” ใช่ไหม?`)) return;

    tasks = tasks.filter(t => t.id !== id);

    // บันทึกการลบในเครื่องก่อน
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    render();

    try {
      const uid = auth.currentUser?.uid;

      if (!uid) {
        throw new Error("ไม่พบผู้ใช้ที่เข้าสู่ระบบ");
      }

      // ลบงานจาก Firestore ด้วย
      await deleteDoc(
        doc(db, "users", uid, "tasks", id)
      );

      showToast("ลบงานเรียบร้อยแล้ว");
    } catch (error) {
      console.error("ลบงานจาก Firestore ไม่สำเร็จ:", error);
      showToast("ลบงานในเครื่องแล้ว แต่ลบออนไลน์ไม่สำเร็จ");
    }
  }

  function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) openModal(task);
  }
  $("#today-label").textContent = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  $("#task-date").min = "2000-01-01";
  $("#open-add").addEventListener("click", () => openModal());
  $("#add-from-list").addEventListener("click", () => openModal());
  $("#close-modal").addEventListener("click", closeModal);
  $("#cancel-modal").addEventListener("click", closeModal);
  $("#modal-backdrop").addEventListener("click", e => { if (e.target === $("#modal-backdrop")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal-backdrop").hidden) closeModal(); });

    $("#task-form").addEventListener("submit", e => {
    e.preventDefault();

    if (!userReady || !STORAGE_KEY) {
      showToast("กรุณาเข้าสู่ระบบก่อนบันทึกงาน");
      return;
    }

    const title = $("#task-title").value.trim();
    const date = $("#task-date").value;
    if (!title || !date) return;
    const editId = $("#task-form").dataset.editId;
    if (editId) {
      const task = tasks.find(t => t.id === editId);
      if (task) Object.assign(task, { title, date, subject: $("#task-subject").value.trim(), note: $("#task-note").value.trim(), updatedAt: Date.now() });
      showToast("บันทึกการแก้ไขแล้ว");
    } else {
      tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2), title, date, subject: $("#task-subject").value.trim(), note: $("#task-note").value.trim(), done: false, createdAt: Date.now() });
      showToast("เพิ่มงานใหม่เรียบร้อยแล้ว ✦");
    }
    saveTasks();
    closeModal();
    render();
  });
  document.addEventListener("change", e => {
    if (e.target.matches("[data-toggle]")) toggleTask(e.target.dataset.toggle, e.target.checked);
  });
  document.addEventListener("click", e => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");
    const go = e.target.closest("[data-go]");
    if (edit) editTask(edit.dataset.edit);
    if (del) deleteTask(del.dataset.delete);
    if (go) setView(go.dataset.go);
  });
  $$(".nav-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $("#search-input").addEventListener("input", renderList);
  $("#status-filter").addEventListener("change", renderList);
  $("#sort-filter").addEventListener("change", renderList);
  $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  window.addEventListener("ngork-user-ready", (event) => {
    const uid = event.detail?.uid;
    if (!uid) return;

    initializeUserTasks(uid);
  });
  window.addEventListener("ngork-user-ready", (event) => {
    const uid = event.detail?.uid;
    if (!uid) return;

    initializeUserTasks(uid);
  });
  setView("dashboard");

/* =========================
   NGORK AI - Gemini Chat
   ========================= */

const NGORK_AI_API_URL = "https://script.google.com/macros/s/AKfycbzK5tZF-sOOBLHZ0K9n7c1hA7oKDcd0jwJcx-Iyok2d63T9ehZJ0HyTpmgtSUA64ks6/exec";

const aiToggle = document.getElementById("ngork-ai-toggle");
const aiPanel = document.getElementById("ngork-ai-panel");
const aiClose = document.getElementById("ngork-ai-close");
const aiForm = document.getElementById("ngork-ai-form");
const aiInput = document.getElementById("ngork-ai-input");
const aiMessages = document.getElementById("ngork-ai-messages");
const aiSend = document.getElementById("ngork-ai-send");

if (aiToggle && aiPanel && aiClose && aiForm &&
    aiInput && aiMessages && aiSend) {

  aiToggle.addEventListener("click", () => {
    aiPanel.hidden = false;
    aiInput.focus();
  });

  aiClose.addEventListener("click", () => {
    aiPanel.hidden = true;
  });

  function addAIMessage(text, sender) {
    const element = document.createElement("div");
    element.className = `ngork-ai-message ${sender}`;
    element.textContent = text;
    aiMessages.appendChild(element);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return element;
  }

  aiForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = aiInput.value.trim();
    if (!message || aiSend.disabled) return;

    addAIMessage(message, "user");
    aiInput.value = "";
    aiSend.disabled = true;
    aiInput.disabled = true;

    const loadingMessage = addAIMessage(
      "กำลังคิดคำตอบให้ครับ…",
      "assistant"
    );

    try {
      const response = await fetch(NGORK_AI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || typeof data.answer !== "string") {
        throw new Error(data.error || "Backend ไม่ได้ส่งคำตอบกลับ");
      }

      loadingMessage.textContent = data.answer;

    } catch (error) {
      console.error("NGORK AI error:", error);

      loadingMessage.textContent =
        error.name === "TimeoutError"
          ? "AI ใช้เวลานานเกินไปครับ ลองส่งใหม่อีกครั้ง"
          : "เชื่อมต่อ AI ไม่สำเร็จครับ กรุณาตรวจสอบ Console";

    } finally {
      aiSend.disabled = false;
      aiInput.disabled = false;
      aiInput.focus();
    }
  });
}

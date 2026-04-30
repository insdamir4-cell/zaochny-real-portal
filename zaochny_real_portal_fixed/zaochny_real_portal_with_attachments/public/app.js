const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let user = JSON.parse(localStorage.getItem("realPortalUser") || "null");
let page = "dashboard";

function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (user) headers["x-user-id"] = user.id;

  return fetch(path, { ...options, headers }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Server error");
    return data;
  });
}

function setTitle(title, sub) {
  $("#pageTitle").textContent = title;
  $("#pageSubtitle").textContent = sub || "";
}

function modal(title, body) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = body;
  $("#modal").classList.remove("hidden");
}

function closeModal() {
  $("#modal").classList.add("hidden");
}

function badge(text, color) {
  return `<span class="badge ${color}">${text}</span>`;
}

function renderShell() {
  if (!user) {
    $("#loginPage").classList.remove("hidden");
    $("#app").classList.add("hidden");
    return;
  }

  $("#loginPage").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#userName").textContent = user.name;
  $("#userRole").textContent = user.role === "teacher" ? "Преподаватель" : "Студент";
  $("#avatar").textContent = user.name[0] || "U";

  $$(".teacherOnly").forEach(el => {
    el.style.display = user.role === "teacher" ? "" : "none";
  });

  render();
}

async function render() {
  $$(".navBtn").forEach(b => b.classList.toggle("active", b.dataset.page === page));

  if (page === "dashboard") await renderDashboard();
  if (page === "tasks") await renderTasks();
  if (page === "submissions") await renderSubmissions();
  if (page === "grades") await renderGrades();
  if (page === "session") renderSession();
  if (page === "profile") renderProfile();
}

async function renderDashboard() {
  setTitle("Главная", "Реальный портал с сервером и базой данных");
  const stats = await api("/api/stats");

  if (user.role === "teacher") {
    $("#content").innerHTML = `
      <div class="grid grid4">
        <div class="card stat"><b>${stats.tasks}</b><span>Создано заданий</span></div>
        <div class="card stat"><b>${stats.submissions}</b><span>Ответов студентов</span></div>
        <div class="card stat"><b>${stats.students}</b><span>Студентов</span></div>
        <div class="card stat"><b>Online</b><span>Сервер работает</span></div>
      </div>
      <div class="grid grid2">
        <div class="card">
          <h3>Быстрое действие</h3>
          <p class="muted">Создай задание — студент с другого устройства увидит его после открытия сайта.</p>
          <br><button class="btn primaryBtn" onclick="openCreateTask()">Создать задание</button>
        </div>
        <div class="card">
          <h3>Как это работает</h3>
          <p class="muted">Все данные сохраняются в SQLite базе на сервере. Поэтому другой пользователь видит задания не из твоего браузера, а из общей базы данных.</p>
        </div>
      </div>
    `;
  } else {
    $("#content").innerHTML = `
      <div class="grid grid4">
        <div class="card stat"><b>${stats.tasks}</b><span>Всего заданий</span></div>
        <div class="card stat"><b>${stats.submitted}</b><span>Сдано</span></div>
        <div class="card stat"><b>${stats.avg_grade}</b><span>Средняя оценка</span></div>
        <div class="card stat"><b>ЗО-23-1</b><span>Группа</span></div>
      </div>
      <div class="card" style="margin-top:18px">
        <h3>Твои действия</h3>
        <p class="muted">Открой раздел “Задания”, выбери задание и отправь ответ. Преподаватель увидит ответ в разделе “Ответы студентов”.</p>
      </div>
    `;
  }
}

async function renderTasks() {
  setTitle("Задания", user.role === "teacher" ? "Создание и управление заданиями" : "Выполнение заданий");
  const tasks = await api("/api/tasks");

  const createButton = user.role === "teacher"
    ? `<button class="btn primaryBtn" onclick="openCreateTask()">+ Создать задание</button>`
    : "";

  $("#content").innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <h3>Список заданий</h3>
        ${createButton}
      </div>
      ${tasks.map(task => taskCard(task)).join("") || `<p class="muted">Пока заданий нет.</p>`}
    </div>
  `;
}

function taskCard(task) {
  const status = task.submission_id
    ? badge(task.grade !== null ? `Оценка: ${task.grade}` : "Сдано", task.grade !== null ? "blue" : "green")
    : badge("Не сдано", "orange");

  const studentActions = user.role === "student"
    ? `<button class="btn primaryBtn" onclick="openSubmitTask(${task.id}, '${escapeHtml(task.title)}')">Выполнить / изменить ответ</button>`
    : "";

  const teacherActions = user.role === "teacher"
    ? `<button class="btn danger" onclick="deleteTask(${task.id})">Удалить</button>`
    : "";

  return `
    <div class="taskCard">
      <div>
        <h3>${escapeHtml(task.title)}</h3>
        <p class="muted"><b>${escapeHtml(task.subject)}</b> • дедлайн: ${task.deadline || "не указан"}</p>
        <p class="muted">${escapeHtml(task.description || "")}</p>
        ${task.file_path || task.photo_path ? `
          <div class="taskMaterials">
            ${task.file_path ? `<a class="fileLink" href="${task.file_path}" target="_blank">📎 Открыть файл задания</a>` : ""}
            ${task.photo_path ? `<a class="fileLink" href="${task.photo_path}" target="_blank">🖼️ Открыть фото задания</a>` : ""}
          </div>
        ` : ""}
        <br>${status}
        ${task.teacher_comment ? `<p class="muted"><b>Комментарий:</b> ${escapeHtml(task.teacher_comment)}</p>` : ""}
      </div>
      <div class="actions">${studentActions}${teacherActions}</div>
    </div>
  `;
}

function openCreateTask() {
  modal("Создать задание", `
    <div class="form">
      <label>Название</label>
      <input id="taskTitle" placeholder="Например: Практическая работа №2">

      <label>Предмет</label>
      <input id="taskSubject" placeholder="Например: Web Development">

      <label>Описание</label>
      <textarea id="taskDescription" placeholder="Что должен сделать студент?"></textarea>

      <label>Прикрепить файл</label>
      <input id="taskFile" type="file">

      <label>Прикрепить фото</label>
      <input id="taskPhoto" type="file" accept="image/png,image/jpeg,image/jpg,image/webp">

      <label>Дедлайн</label>
      <input id="taskDeadline" type="date">

      <button class="primary" onclick="createTask()">Сохранить задание</button>
    </div>
  `);
}

async function createTask() {
  const title = $("#taskTitle").value.trim();
  const subject = $("#taskSubject").value.trim();
  const description = $("#taskDescription").value.trim();
  const deadline = $("#taskDeadline").value;

  if (!title || !subject) {
    alert("Заполни название и предмет");
    return;
  }

  const form = new FormData();
  form.append("title", title);
  form.append("subject", subject);
  form.append("description", description);
  form.append("deadline", deadline);

  const taskFile = $("#taskFile").files[0];
  const taskPhoto = $("#taskPhoto").files[0];

  if (taskFile) form.append("taskFile", taskFile);
  if (taskPhoto) form.append("taskPhoto", taskPhoto);

  await api("/api/tasks", {
    method: "POST",
    body: form,
    headers: user ? { "x-user-id": user.id } : {}
  });

  closeModal();
  page = "tasks";
  await render();
}

function openSubmitTask(taskId, title) {
  modal("Выполнить задание", `
    <div class="form">
      <p class="muted"><b>${title}</b></p>
      <label>Ответ студента</label>
      <textarea id="answerText" placeholder="Напиши ответ или комментарий к файлу..."></textarea>
      <label>Файл</label>
      <input id="answerFile" type="file">
      <button class="primary" onclick="submitTask(${taskId})">Отправить ответ</button>
    </div>
  `);
}

async function submitTask(taskId) {
  const form = new FormData();
  form.append("answer", $("#answerText").value.trim());
  const file = $("#answerFile").files[0];
  if (file) form.append("file", file);

  await api(`/api/tasks/${taskId}/submit`, {
    method: "POST",
    body: form,
    headers: user ? { "x-user-id": user.id } : {}
  });

  closeModal();
  await renderTasks();
}

async function deleteTask(id) {
  if (!confirm("Удалить задание и все ответы студентов?")) return;
  await api(`/api/tasks/${id}`, { method: "DELETE" });
  await renderTasks();
}

async function renderSubmissions() {
  setTitle("Ответы студентов", "Проверка работ и выставление оценок");
  const rows = await api("/api/submissions");

  $("#content").innerHTML = `
    <div class="card">
      <h3>Сданные работы</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Студент</th>
            <th>Задание</th>
            <th>Ответ</th>
            <th>Файл</th>
            <th>Оценка</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><b>${escapeHtml(r.student_name)}</b><br><span class="muted">${escapeHtml(r.group_name || "")}</span></td>
              <td>${escapeHtml(r.task_title)}<br><span class="muted">${escapeHtml(r.subject)}</span></td>
              <td>${escapeHtml(r.answer || "")}</td>
              <td>${r.file_path ? `<a class="fileLink" href="${r.file_path}" target="_blank">Открыть файл</a>` : "—"}</td>
              <td>${r.grade !== null ? badge(r.grade, "blue") : badge("Нет", "orange")}<br><span class="muted">${escapeHtml(r.teacher_comment || "")}</span></td>
              <td><button class="btn primaryBtn" onclick="openGrade(${r.id})">Оценить</button></td>
            </tr>
          `).join("") || `<tr><td colspan="6">Ответов пока нет.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function openGrade(id) {
  modal("Оценить работу", `
    <div class="form">
      <label>Оценка 0-100</label>
      <input id="gradeInput" type="number" min="0" max="100" placeholder="95">
      <label>Комментарий</label>
      <textarea id="commentInput" placeholder="Комментарий преподавателя"></textarea>
      <button class="primary" onclick="saveGrade(${id})">Сохранить оценку</button>
    </div>
  `);
}

async function saveGrade(id) {
  const grade = Number($("#gradeInput").value);
  const teacher_comment = $("#commentInput").value.trim();

  if (Number.isNaN(grade) || grade < 0 || grade > 100) {
    alert("Оценка должна быть от 0 до 100");
    return;
  }

  await api(`/api/submissions/${id}/grade`, {
    method: "PATCH",
    body: JSON.stringify({ grade, teacher_comment })
  });

  closeModal();
  await renderSubmissions();
}

async function renderGrades() {
  setTitle("Оценки", "Оценки появляются после проверки преподавателем");
  if (user.role === "teacher") {
    $("#content").innerHTML = `
      <div class="card">
        <h3>Для преподавателя</h3>
        <p class="muted">Оценки выставляются в разделе “Ответы студентов”.</p>
        <br><button class="btn primaryBtn" onclick="page='submissions';render()">Открыть ответы студентов</button>
      </div>
    `;
    return;
  }

  const tasks = await api("/api/tasks");
  const graded = tasks.filter(t => t.submission_id);

  $("#content").innerHTML = `
    <div class="card">
      <h3>Мои оценки</h3>
      <table class="table">
        <thead><tr><th>Задание</th><th>Предмет</th><th>Статус</th><th>Оценка</th><th>Комментарий</th></tr></thead>
        <tbody>
          ${graded.map(t => `
            <tr>
              <td>${escapeHtml(t.title)}</td>
              <td>${escapeHtml(t.subject)}</td>
              <td>${badge("Сдано", "green")}</td>
              <td>${t.grade !== null ? badge(t.grade, "blue") : "Пока не проверено"}</td>
              <td>${escapeHtml(t.teacher_comment || "—")}</td>
            </tr>
          `).join("") || `<tr><td colspan="5">Ты пока не сдавал задания.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderSession() {
  setTitle("Сессия", "Расписание консультаций и экзаменов");
  $("#content").innerHTML = `
    <div class="card">
      <h3>План сессии</h3>
      <table class="table">
        <thead><tr><th>Дата</th><th>Предмет</th><th>Тип</th><th>Формат</th></tr></thead>
        <tbody>
          <tr><td>20.05.2026</td><td>Web Development</td><td>Консультация</td><td>Online Zoom</td></tr>
          <tr><td>25.05.2026</td><td>Web Development</td><td>Экзамен</td><td>LMS Test</td></tr>
          <tr><td>28.05.2026</td><td>Database Systems</td><td>Экзамен</td><td>College / Online</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderProfile() {
  setTitle("Профиль", "Данные текущего пользователя");
  $("#content").innerHTML = `
    <div class="grid grid2">
      <div class="card">
        <h3>Личные данные</h3>
        <p><b>ФИО:</b> ${escapeHtml(user.name)}</p>
        <p><b>Логин:</b> ${escapeHtml(user.login)}</p>
        <p><b>Роль:</b> ${escapeHtml(user.role)}</p>
        <p><b>Группа:</b> ${escapeHtml(user.group_name || "—")}</p>
      </div>
      <div class="card">
        <h3>Важно</h3>
        <p class="muted">Чтобы другой человек открыл сайт, сервер должен быть запущен, а ссылка должна вести на этот сервер.</p>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginError").textContent = "";

  try {
    user = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        login: $("#loginInput").value.trim(),
        password: $("#passwordInput").value.trim()
      })
    });

    localStorage.setItem("realPortalUser", JSON.stringify(user));
    page = "dashboard";
    renderShell();
  } catch (err) {
    $("#loginError").textContent = err.message;
  }
});

$$(".navBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    page = btn.dataset.page;
    render();
  });
});

$("#logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("realPortalUser");
  user = null;
  renderShell();
});

$("#refreshBtn").addEventListener("click", () => render());

$("#openIpHelp").addEventListener("click", () => {
  modal("Как открыть с другого устройства", `
    <p class="muted">
      1. Запусти сервер командой <b>npm start</b>.<br>
      2. Узнай IP компьютера, где запущен сервер.<br>
      Windows: открой CMD и напиши <b>ipconfig</b>.<br>
      3. Другой человек в той же Wi-Fi сети открывает:<br>
      <b>http://ТВОЙ-IP:3000</b><br><br>
      Пример: <b>http://192.168.1.15:3000</b>
    </p>
    <br>
    <p class="muted">
      Если нужно, чтобы сайт работал через интернет, его надо загрузить на хостинг: Render, Railway, VPS или другой сервер.
    </p>
  `);
});

$("#closeModal").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") closeModal();
});

renderShell();
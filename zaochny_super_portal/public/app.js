
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let user = JSON.parse(localStorage.getItem("zSuperUser") || "null");
let page = "dashboard";
let cache = { groups: [], subjects: [], users: [] };

function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (user) headers["x-user-id"] = user.id;
  return fetch(path, { ...options, headers }).then(async r => {
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || "Ошибка сервера");
    return data;
  });
}
function esc(x){return String(x ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function badge(t,c){return `<span class="badge ${c}">${t}</span>`}
function setTitle(t,s=""){ $("#pageTitle").textContent=t; $("#pageSubtitle").textContent=s; }
function modal(t,b){ $("#modalTitle").textContent=t; $("#modalBody").innerHTML=b; $("#modal").classList.remove("hidden"); }
function closeModal(){ $("#modal").classList.add("hidden"); }
function toast(t){ modal("Info", `<p class="muted">${t}</p>`); setTimeout(closeModal,1000); }
function roleName(){ return user.role === "admin" ? "Админ" : user.role === "teacher" ? "Преподаватель" : "Студент"; }

const navByRole = {
  admin: [["dashboard","🏠","Главная"],["admin","🛠","Админ-панель"],["groups","👥","Группы"],["subjects","📚","Предметы"],["tasks","✅","Задания"],["submissions","📥","Ответы"],["tests","🧪","Тесты"],["chat","💬","Чат"],["notifications","🔔","Уведомления"],["audit","🧾","История"],["profile","👤","Профиль"]],
  teacher: [["dashboard","🏠","Главная"],["subjects","📚","Предметы"],["tasks","✅","Задания"],["submissions","📥","Ответы"],["tests","🧪","Тесты"],["chat","💬","Чат"],["notifications","🔔","Уведомления"],["export","📤","Экспорт"],["profile","👤","Профиль"]],
  student: [["dashboard","🏠","Главная"],["subjects","📚","Модули"],["tasks","✅","Задания"],["tests","🧪","Тесты"],["progress","📈","Прогресс"],["certificate","🎓","Сертификат"],["session","📝","Сессия"],["chat","💬","Чат"],["notifications","🔔","Уведомления"],["profile","👤","Профиль"]]
};

async function loadBase(){
  if (!user) return;
  cache.groups = await api("/api/groups").catch(()=>[]);
  cache.subjects = await api("/api/subjects").catch(()=>[]);
  if (user.role !== "student") cache.users = await api("/api/users").catch(()=>[]);
}

function renderShell(){
  if(!user){ $("#loginPage").classList.remove("hidden"); $("#app").classList.add("hidden"); loadRegGroups(); return; }
  $("#loginPage").classList.add("hidden"); $("#app").classList.remove("hidden");
  $("#userName").textContent = user.name; $("#userRole").textContent = roleName(); $("#avatar").textContent = user.name[0] || "U";
  $("#nav").innerHTML = navByRole[user.role].map(n=>`<button class="nav-btn ${page===n[0]?'active':''}" data-page="${n[0]}">${n[1]} ${n[2]}</button>`).join("");
  $$(".nav-btn").forEach(b=>b.onclick=()=>{page=b.dataset.page; render();});
  render();
}
async function render(){
  await loadBase();
  $$(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.page===page));
  updateNotifCount();
  if(page==="dashboard") return dashboard();
  if(page==="admin") return adminPage();
  if(page==="groups") return groupsPage();
  if(page==="subjects") return subjectsPage();
  if(page==="tasks") return tasksPage();
  if(page==="submissions") return submissionsPage();
  if(page==="tests") return testsPage();
  if(page==="progress") return progressPage();
  if(page==="certificate") return certificatePage();
  if(page==="session") return sessionPage();
  if(page==="chat") return chatPage();
  if(page==="notifications") return notificationsPage();
  if(page==="audit") return auditPage();
  if(page==="export") return exportPage();
  if(page==="profile") return profilePage();
}

async function dashboard(){
  setTitle("Главная", "Панель управления");
  const s = await api("/api/stats");
  let cards = "";
  Object.entries(s).forEach(([k,v])=>cards += `<div class="card stat"><b>${v}</b><span>${k}</span></div>`);
  $("#content").innerHTML = `<div class="grid grid4">${cards}</div>
  <div class="grid grid2">
    <div class="card"><h3>Быстрые действия</h3><div class="actions">
      ${user.role!=="student"?`<button class="btn primaryBtn" onclick="openTaskForm()">Создать задание</button><button class="btn" onclick="openSubjectForm()">Добавить предмет</button><button class="btn" onclick="openTestForm()">Создать тест</button>`:`<button class="btn primaryBtn" onclick="page='tasks';render()">Открыть задания</button><button class="btn" onclick="page='progress';render()">Мой прогресс</button>`}
    </div></div>
    <div class="card"><h3>Что добавлено</h3><p class="muted">Админ-панель, группы, предметы, задания с файлами/фото, тесты, чат, уведомления, прогресс, сертификат, экспорт CSV и история действий.</p></div>
  </div>`;
}

async function adminPage(){
  setTitle("Админ-панель", "Пользователи и подтверждение регистрации");
  const users = await api("/api/users");
  $("#content").innerHTML = `<div class="card"><h3>Пользователи</h3><table class="table"><thead><tr><th>ФИО</th><th>Логин</th><th>Роль</th><th>Группа</th><th>Статус</th><th></th></tr></thead><tbody>
  ${users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.login)}</td><td>${u.role}</td><td>${esc(u.group_name||"—")}</td><td>${u.approved?badge("Подтверждён","green"):badge("Ждёт","orange")}</td><td>${!u.approved?`<button class="btn success" onclick="approveUser(${u.id})">Подтвердить</button>`:""}</td></tr>`).join("")}
  </tbody></table></div>`;
}
async function approveUser(id){ await api(`/api/users/${id}/approve`,{method:"PATCH",body:"{}"}); toast("Подтверждено"); render(); }

function groupOptions(selected=""){ return cache.groups.map(g=>`<option value="${g.id}" ${String(selected)===String(g.id)?"selected":""}>${esc(g.name)}</option>`).join(""); }
function subjectOptions(selected=""){ return cache.subjects.map(s=>`<option value="${s.id}" ${String(selected)===String(s.id)?"selected":""}>${esc(s.title)} (${esc(s.group_name||"")})</option>`).join(""); }

async function groupsPage(){
  setTitle("Группы", "Группы заочного обучения");
  $("#content").innerHTML = `<div class="card"><div class="actions" style="justify-content:space-between"><h3>Группы</h3>${user.role==="admin"?`<button class="btn primaryBtn" onclick="openGroupForm()">+ Группа</button>`:""}</div>
  ${cache.groups.map(g=>`<div class="list-item"><div><h3>${esc(g.name)}</h3><p class="muted">Куратор: ${esc(g.curator||"—")}</p></div></div>`).join("")}</div>`;
}
function openGroupForm(){ modal("Добавить группу", `<div class="form"><label>Название группы</label><input id="gName" placeholder="ЗО-25-1"><label>Куратор</label><input id="gCurator"><button class="primary" onclick="saveGroup()">Сохранить</button></div>`); }
async function saveGroup(){ await api("/api/groups",{method:"POST",body:JSON.stringify({name:$("#gName").value,curator:$("#gCurator").value})}); closeModal(); render(); }

async function subjectsPage(){
  setTitle("Предметы / модули", user.role==="student"?"Ваши учебные модули":"Управление предметами");
  $("#content").innerHTML = `<div class="card"><div class="actions" style="justify-content:space-between"><h3>Предметы</h3>${user.role!=="student"?`<button class="btn primaryBtn" onclick="openSubjectForm()">+ Предмет</button>`:""}</div>
  <div class="grid grid2">${cache.subjects.map(s=>`<div class="card"><h3>${esc(s.title)}</h3><p class="muted">${esc(s.description||"")}</p><p>Группа: <b>${esc(s.group_name||"—")}</b></p><p>Преподаватель: <b>${esc(s.teacher_name||"—")}</b></p><p>Кредиты: ${s.credits}</p></div>`).join("")}</div></div>`;
}
function openSubjectForm(){ modal("Добавить предмет", `<div class="form"><label>Название</label><input id="subTitle"><label>Группа</label><select id="subGroup">${groupOptions()}</select><label>Описание</label><textarea id="subDesc"></textarea><label>Кредиты</label><input id="subCredits" type="number" value="3"><button class="primary" onclick="saveSubject()">Сохранить</button></div>`); }
async function saveSubject(){ await api("/api/subjects",{method:"POST",body:JSON.stringify({title:$("#subTitle").value, group_id:$("#subGroup").value, description:$("#subDesc").value, credits:$("#subCredits").value})}); closeModal(); render(); }

async function tasksPage(){
  setTitle("Задания", user.role==="student"?"Выполнение заданий":"Создание заданий");
  const tasks = await api("/api/tasks");
  $("#content").innerHTML = `<div class="card"><div class="actions" style="justify-content:space-between"><h3>Задания</h3>${user.role!=="student"?`<button class="btn primaryBtn" onclick="openTaskForm()">+ Задание</button>`:""}</div>
  ${tasks.map(taskCard).join("") || `<p class="muted">Заданий нет.</p>`}</div>`;
}
function taskCard(t){
  const status = t.submission_id ? (t.grade!==null?badge("Оценка: "+t.grade,"blue"):badge("Сдано","green")) : badge("Не сдано","orange");
  return `<div class="task-card"><div><h3>${esc(t.title)}</h3><p class="muted">${esc(t.subject_title||"Без предмета")} • ${esc(t.group_name||"")} • дедлайн: ${esc(t.deadline||"—")}</p><p class="muted">${esc(t.description||"")}</p>
  ${t.file_path?`<a class="fileLink" href="${t.file_path}" target="_blank">📎 Файл задания</a>`:""} ${t.photo_path?`<a class="fileLink" href="${t.photo_path}" target="_blank">🖼️ Фото задания</a>`:""}
  <br><br>${status}${t.teacher_comment?`<p class="muted"><b>Комментарий:</b> ${esc(t.teacher_comment)}</p>`:""}</div>
  <div class="actions">${user.role==="student"?`<button class="btn primaryBtn" onclick="openSubmit(${t.id})">Выполнить</button>`:`<button class="btn danger" onclick="deleteTask(${t.id})">Удалить</button>`}</div></div>`;
}
function openTaskForm(){ modal("Создать задание", `<div class="form"><label>Название</label><input id="taskTitle"><div class="form-row"><div><label>Предмет</label><select id="taskSubject">${subjectOptions()}</select></div><div><label>Группа</label><select id="taskGroup">${groupOptions()}</select></div></div><label>Описание</label><textarea id="taskDesc"></textarea><div class="form-row"><div><label>Прикрепить файл</label><input id="taskFile" type="file"></div><div><label>Прикрепить фото</label><input id="taskPhoto" type="file" accept="image/*"></div></div><label>Дедлайн</label><input id="taskDeadline" type="date"><button class="primary" onclick="saveTask()">Сохранить задание</button></div>`); }
async function saveTask(){ const f=new FormData(); f.append("title",$("#taskTitle").value); f.append("subject_id",$("#taskSubject").value); f.append("group_id",$("#taskGroup").value); f.append("description",$("#taskDesc").value); f.append("deadline",$("#taskDeadline").value); if($("#taskFile").files[0])f.append("taskFile",$("#taskFile").files[0]); if($("#taskPhoto").files[0])f.append("taskPhoto",$("#taskPhoto").files[0]); await api("/api/tasks",{method:"POST",body:f,headers:{"x-user-id":user.id}}); closeModal(); render(); }
function openSubmit(id){ modal("Сдать задание", `<div class="form"><label>Ответ</label><textarea id="answer"></textarea><label>Файл ответа</label><input id="answerFile" type="file"><button class="primary" onclick="submitTask(${id})">Отправить</button></div>`); }
async function submitTask(id){ const f=new FormData(); f.append("answer",$("#answer").value); if($("#answerFile").files[0])f.append("file",$("#answerFile").files[0]); await api(`/api/tasks/${id}/submit`,{method:"POST",body:f,headers:{"x-user-id":user.id}}); closeModal(); render(); }
async function deleteTask(id){ if(confirm("Удалить?")){ await api(`/api/tasks/${id}`,{method:"DELETE"}); render(); } }

async function submissionsPage(){
  setTitle("Ответы студентов", "Проверка работ");
  const rows = await api("/api/submissions");
  $("#content").innerHTML = `<div class="card"><div class="actions" style="justify-content:space-between"><h3>Ответы</h3><a class="btn" href="/api/export/submissions.csv" target="_blank">📤 CSV</a></div><table class="table"><thead><tr><th>Студент</th><th>Задание</th><th>Ответ</th><th>Файл</th><th>Оценка</th><th></th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${esc(r.student_name)}<br><span class="muted">${esc(r.group_name||"")}</span></td><td>${esc(r.task_title)}<br><span class="muted">${esc(r.subject_title||"")}</span></td><td>${esc(r.answer||"")}</td><td>${r.file_path?`<a class="fileLink" target="_blank" href="${r.file_path}">Открыть</a>`:"—"}</td><td>${r.grade!==null?badge(r.grade,"blue"):badge("Нет","orange")}<br>${esc(r.teacher_comment||"")}</td><td><button class="btn primaryBtn" onclick="openGrade(${r.id})">Оценить</button></td></tr>`).join("") || `<tr><td colspan="6">Ответов нет</td></tr>`}
  </tbody></table></div>`;
}
function openGrade(id){ modal("Оценить", `<div class="form"><label>Оценка 0-100</label><input id="grade" type="number"><label>Комментарий</label><textarea id="comment"></textarea><button class="primary" onclick="saveGrade(${id})">Сохранить</button></div>`); }
async function saveGrade(id){ await api(`/api/submissions/${id}/grade`,{method:"PATCH",body:JSON.stringify({grade:Number($("#grade").value),teacher_comment:$("#comment").value})}); closeModal(); render(); }

async function testsPage(){
  setTitle("Тесты", user.role==="student"?"Прохождение тестов":"Создание тестов");
  const tests = await api("/api/tests");
  $("#content").innerHTML = `<div class="card"><div class="actions" style="justify-content:space-between"><h3>Тесты</h3>${user.role!=="student"?`<button class="btn primaryBtn" onclick="openTestForm()">+ Тест</button>`:""}</div>
  ${tests.map(t=>`<div class="list-item"><div><h3>${esc(t.title)}</h3><p class="muted">${esc(t.subject_title||"")} • ${esc(t.group_name||"")}</p>${t.attempt_id?badge(`${t.percent}% (${t.score}/${t.total})`,"blue"):""}</div><div>${user.role==="student"?`<button class="btn primaryBtn" onclick="openTest(${t.id})">Пройти</button>`:""}</div></div>`).join("")}</div>`;
}
function openTestForm(){ modal("Создать тест", `<div class="form"><label>Название теста</label><input id="testTitle"><div class="form-row"><div><label>Предмет</label><select id="testSubject">${subjectOptions()}</select></div><div><label>Группа</label><select id="testGroup">${groupOptions()}</select></div></div><p class="muted">Будут созданы 3 вопроса. Потом можно расширить кодом.</p>${[1,2,3].map(i=>`<div class="question"><b>Вопрос ${i}</b><input id="q${i}" placeholder="Вопрос"><input id="q${i}a" placeholder="A"><input id="q${i}b" placeholder="B"><input id="q${i}c" placeholder="C"><input id="q${i}d" placeholder="D"><select id="q${i}correct"><option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option></select></div>`).join("")}<button class="primary" onclick="saveTest()">Сохранить тест</button></div>`); }
async function saveTest(){ const questions=[1,2,3].map(i=>({question:$(`#q${i}`).value,a:$(`#q${i}a`).value,b:$(`#q${i}b`).value,c:$(`#q${i}c`).value,d:$(`#q${i}d`).value,correct:$(`#q${i}correct`).value})).filter(q=>q.question&&q.a&&q.b); await api("/api/tests",{method:"POST",body:JSON.stringify({title:$("#testTitle").value,subject_id:$("#testSubject").value,group_id:$("#testGroup").value,questions})}); closeModal(); render(); }
async function openTest(id){ const data=await api(`/api/tests/${id}`); modal(data.test.title, `<div class="form">${data.questions.map(q=>`<div class="question"><b>${esc(q.question)}</b>${["a","b","c","d"].map(x=>`<label><input style="width:auto" type="radio" name="q${q.id}" value="${x}"> ${x.toUpperCase()}) ${esc(q[x])}</label>`).join("")}</div>`).join("")}<button class="primary" onclick="submitTest(${id})">Завершить тест</button></div>`); }
async function submitTest(id){ const answers={}; $$("input[type=radio]:checked").forEach(i=>answers[i.name.slice(1)]=i.value); const r=await api(`/api/tests/${id}/submit`,{method:"POST",body:JSON.stringify({answers})}); modal("Результат", `<h2>${r.percent}%</h2><p class="muted">${r.score} из ${r.total}</p>`); render(); }

async function progressPage(){ setTitle("Прогресс", "Твой учебный прогресс"); const p=await api("/api/progress"); $("#content").innerHTML=`<div class="grid grid4"><div class="card stat"><b>${p.donePercent}%</b><span>Задания</span></div><div class="card stat"><b>${p.avgGrade}</b><span>Средняя оценка</span></div><div class="card stat"><b>${p.testAvg}%</b><span>Тесты</span></div><div class="card stat"><b>${p.finalProgress}%</b><span>Общий прогресс</span></div></div><div class="card"><h3>Общий прогресс</h3><div class="progress"><div style="width:${p.finalProgress}%"></div></div></div>`; }
function certificatePage(){ setTitle("Сертификат", "Генерация сертификата"); $("#content").innerHTML=`<div class="card cert-card"><h3>Сертификат об обучении</h3><p class="muted">После выполнения работ можно открыть сертификат и сохранить как PDF.</p><br><a class="btn primaryBtn" href="/certificate/${user.id}" target="_blank">Открыть сертификат</a></div>`; }
function sessionPage(){ setTitle("Сессия", "Расписание консультаций и экзаменов"); $("#content").innerHTML=`<div class="card"><h3>План сессии</h3><table class="table"><tr><th>Дата</th><th>Предмет</th><th>Тип</th><th>Формат</th></tr><tr><td>20.05.2026</td><td>Web Development</td><td>Консультация</td><td>Zoom</td></tr><tr><td>25.05.2026</td><td>Web Development</td><td>Экзамен</td><td>LMS</td></tr><tr><td>28.05.2026</td><td>Database Systems</td><td>Экзамен</td><td>Online</td></tr></table></div>`; }

async function chatPage(){ setTitle("Чат", "Сообщения между ролями"); const msgs=await api("/api/messages"); $("#content").innerHTML=`<div class="card"><h3>Написать сообщение</h3><div class="form-row"><select id="msgRole"><option value="teacher">Преподавателям</option><option value="student">Студентам</option><option value="admin">Админу</option></select><button class="btn primaryBtn" onclick="sendMsg()">Отправить</button></div><textarea id="msgText" placeholder="Текст сообщения"></textarea></div><div class="card"><h3>Сообщения</h3>${msgs.map(m=>`<div class="chat-msg"><b>${esc(m.from_name||"System")}</b><p>${esc(m.text)}</p><span class="muted">${m.created_at}</span></div>`).join("")}</div>`; }
async function sendMsg(){ await api("/api/messages",{method:"POST",body:JSON.stringify({to_role:$("#msgRole").value,text:$("#msgText").value})}); render(); }

async function notificationsPage(){ setTitle("Уведомления", "Системные события"); const rows=await api("/api/notifications"); $("#content").innerHTML=`<div class="card"><button class="btn" onclick="markRead()">Отметить прочитанными</button>${rows.map(n=>`<div class="list-item"><div><h3>${esc(n.title)}</h3><p class="muted">${esc(n.text||"")}</p><span class="muted">${n.created_at}</span></div>${n.is_read?badge("read","green"):badge("new","orange")}</div>`).join("")}</div>`; }
async function markRead(){ await api("/api/notifications/read",{method:"PATCH",body:"{}"}); render(); }
async function updateNotifCount(){ if(!user)return; const rows=await api("/api/notifications").catch(()=>[]); const c=rows.filter(x=>!x.is_read).length; $("#notifCount").textContent=c?c:""; }

async function auditPage(){ setTitle("История действий", "Audit log"); const rows=await api("/api/audit"); $("#content").innerHTML=`<div class="card"><table class="table"><tr><th>Пользователь</th><th>Действие</th><th>Детали</th><th>Дата</th></tr>${rows.map(r=>`<tr><td>${esc(r.user_name||"")}</td><td>${esc(r.action)}</td><td>${esc(r.details||"")}</td><td>${r.created_at}</td></tr>`).join("")}</table></div>`; }
function exportPage(){ setTitle("Экспорт", "Скачать таблицы"); $("#content").innerHTML=`<div class="card"><h3>Экспорт CSV</h3><p class="muted">Скачай таблицу ответов студентов.</p><br><a class="btn primaryBtn" href="/api/export/submissions.csv" target="_blank">Скачать submissions.csv</a></div>`; }
function profilePage(){ setTitle("Профиль", "Данные аккаунта"); $("#content").innerHTML=`<div class="grid grid2"><div class="card"><h3>${esc(user.name)}</h3><p><b>Логин:</b> ${esc(user.login)}</p><p><b>Роль:</b> ${roleName()}</p><p><b>Группа:</b> ${esc(user.group_name||"—")}</p><p><b>Email:</b> ${esc(user.email||"—")}</p></div><div class="card"><h3>Ссылка сайта</h3><p class="muted">Отправь ссылку Render студентам. Они смогут зайти и выполнить задания.</p></div></div>`; }

async function loadRegGroups(){ try{ const gs=await fetch("/api/groups",{headers:{"x-user-id":"1"}}).then(r=>r.json()); $("#regGroup").innerHTML=gs.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join(""); }catch(e){} }

$("#loginForm").onsubmit=async e=>{ e.preventDefault(); $("#loginError").textContent=""; try{ user=await api("/api/login",{method:"POST",body:JSON.stringify({login:$("#loginInput").value.trim(),password:$("#passwordInput").value.trim()})}); localStorage.setItem("zSuperUser",JSON.stringify(user)); page="dashboard"; renderShell(); }catch(err){ $("#loginError").textContent=err.message; } };
$("#registerForm").onsubmit=async e=>{ e.preventDefault(); await fetch("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:$("#regName").value,login:$("#regLogin").value,password:$("#regPassword").value,email:$("#regEmail").value,group_id:$("#regGroup").value})}); toast("Заявка отправлена. Ждите подтверждения админа."); };
$$("[data-login-tab]").forEach(b=>b.onclick=()=>{ $$("[data-login-tab]").forEach(x=>x.classList.remove("active")); b.classList.add("active"); $("#loginForm").classList.toggle("hidden",b.dataset.loginTab!=="login"); $("#registerForm").classList.toggle("hidden",b.dataset.loginTab!=="register"); });
$("#logoutBtn").onclick=()=>{localStorage.removeItem("zSuperUser"); user=null; renderShell();};
$("#refreshBtn").onclick=()=>render();
$("#notifyBtn").onclick=()=>{page="notifications";render();};
$("#closeModal").onclick=closeModal; $("#modal").onclick=e=>{if(e.target.id==="modal")closeModal();};
$("#burger").onclick=()=>document.querySelector(".sidebar").scrollIntoView({behavior:"smooth"});
renderShell();


const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const db = new sqlite3.Database(path.join(dataDir, "portal.db"));

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^\wа-яА-ЯёЁқҚғҒүҮұҰіІңҢөӨһҺ.\-]/g, "_");
    cb(null, Date.now() + "_" + safe);
  }
});
const upload = multer({ storage });

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    curator TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    group_id INTEGER,
    email TEXT,
    approved INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    teacher_id INTEGER,
    group_id INTEGER,
    description TEXT,
    credits INTEGER DEFAULT 3,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject_id INTEGER,
    group_id INTEGER,
    description TEXT,
    deadline TEXT,
    created_by INTEGER,
    file_path TEXT,
    photo_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    answer TEXT,
    file_path TEXT,
    status TEXT DEFAULT 'submitted',
    grade INTEGER,
    teacher_comment TEXT,
    submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, student_id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject_id INTEGER,
    group_id INTEGER,
    created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    question TEXT NOT NULL,
    a TEXT NOT NULL,
    b TEXT NOT NULL,
    c TEXT NOT NULL,
    d TEXT NOT NULL,
    correct TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS test_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    student_id INTEGER,
    score INTEGER,
    total INTEGER,
    percent INTEGER,
    answers TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_id, student_id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user INTEGER,
    to_user INTEGER,
    to_role TEXT,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    role TEXT,
    title TEXT NOT NULL,
    text TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await seed();
}

async function seed() {
  await run(`INSERT OR IGNORE INTO groups(id, name, curator) VALUES
    (1, 'ЗО-23-1', 'Преподаватель IT'),
    (2, 'ЗО-24-1', 'Куратор колледжа')`);

  const users = [
    [1, "admin", "1234", "admin", "Администратор", null, "admin@college.kz"],
    [2, "teacher", "1234", "teacher", "Преподаватель IT", null, "teacher@college.kz"],
    [3, "student", "1234", "student", "Мерей Дениселам", 1, "student@college.kz"],
    [4, "student2", "1234", "student", "Алихан Нурлан", 1, "student2@college.kz"]
  ];
}

async function seedUsersAndData() {}
async function realSeed() {
  const users = [
    [1, "admin", "1234", "admin", "Администратор", null, "admin@college.kz"],
    [2, "teacher", "1234", "teacher", "Преподаватель IT", null, "teacher@college.kz"],
    [3, "student", "1234", "student", "Мерей Дениселам", 1, "student@college.kz"],
    [4, "student2", "1234", "student", "Алихан Нурлан", 1, "student2@college.kz"]
  ];
  for (const u of users) {
    await run(`INSERT INTO users(id, login, password, role, name, group_id, email)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(login) DO UPDATE SET password=excluded.password, role=excluded.role, name=excluded.name, group_id=excluded.group_id, email=excluded.email`, u);
  }

  await run(`INSERT OR IGNORE INTO subjects(id, title, teacher_id, group_id, description, credits) VALUES
    (1, 'Web Development', 2, 1, 'HTML, CSS, JavaScript және сайт жасау', 5),
    (2, 'Database Systems', 2, 1, 'SQL, SQLite, кестелер және сұраныстар', 4),
    (3, 'English B1', 2, 1, 'Speaking, grammar and writing', 3)`);

  const countTasks = await get("SELECT COUNT(*) AS c FROM tasks");
  if (countTasks.c === 0) {
    await run(`INSERT INTO tasks(title, subject_id, group_id, description, deadline, created_by)
      VALUES(?,?,?,?,?,?)`, ["Практическая работа №1", 1, 1, "Сделать простую HTML/CSS страницу и отправить ссылку или файл.", "2026-05-10", 2]);
    await run(`INSERT INTO tasks(title, subject_id, group_id, description, deadline, created_by)
      VALUES(?,?,?,?,?,?)`, ["SQL тапсырмасы", 2, 1, "SELECT, WHERE, JOIN бойынша тапсырманы орындаңыз.", "2026-05-15", 2]);
  }

  const countTests = await get("SELECT COUNT(*) AS c FROM tests");
  if (countTests.c === 0) {
    await run(`INSERT INTO tests(id, title, subject_id, group_id, created_by) VALUES(1, 'HTML/CSS мини-тест', 1, 1, 2)`);
    await run(`INSERT INTO questions(test_id, question, a, b, c, d, correct) VALUES
      (1, 'HTML не үшін қолданылады?', 'Дизайн үшін', 'Құрылым үшін', 'Дерекқор үшін', 'Сервер үшін', 'b'),
      (1, 'CSS не үшін керек?', 'Стиль беру үшін', 'Пароль сақтау үшін', 'Файл жүктеу үшін', 'SQL жазу үшін', 'a'),
      (1, 'JavaScript не қосады?', 'Интерактивтілік', 'Тек сурет', 'Тек мәтін', 'Тек база', 'a')`);
  }
}
seed = realSeed;

function authUser(req, res, next) {
  const userId = Number(req.headers["x-user-id"]);
  if (!userId) return res.status(401).json({ error: "No user id" });
  db.get("SELECT u.*, g.name AS group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.id=?", [userId], (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(401).json({ error: "Invalid user" });
    req.user = user;
    next();
  });
}
function role(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: "No permission" });
}
async function log(userId, action, details = "") {
  try { await run("INSERT INTO audit_log(user_id, action, details) VALUES(?,?,?)", [userId, action, details]); } catch(e) {}
}
async function notify({ userId=null, role=null, title, text="" }) {
  await run("INSERT INTO notifications(user_id, role, title, text) VALUES(?,?,?,?)", [userId, role, title, text]);
}

app.post("/api/login", async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = await get("SELECT u.id, u.login, u.role, u.name, u.email, u.group_id, g.name AS group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE login=? AND password=? AND approved=1", [login, password]);
    if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });
    await log(user.id, "login", "Вход в систему");
    res.json(user);
  } catch(e) { res.status(500).json({ error: "Database error" }); }
});

app.post("/api/register", async (req, res) => {
  try {
    const { login, password, name, email, group_id } = req.body;
    if (!login || !password || !name) return res.status(400).json({ error: "Fill all fields" });
    const result = await run("INSERT INTO users(login,password,role,name,email,group_id,approved) VALUES(?,?,?,?,?,?,0)", [login,password,"student",name,email||"",group_id||1]);
    await notify({ role:"admin", title:"Новая регистрация", text:`Студент ${name} ждёт подтверждения` });
    res.json({ id: result.lastID });
  } catch(e) { res.status(400).json({ error: "Login already exists or database error" }); }
});

app.get("/api/me", authUser, (req, res) => res.json(req.user));

app.get("/api/stats", authUser, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const users = await get("SELECT COUNT(*) AS c FROM users");
      const groups = await get("SELECT COUNT(*) AS c FROM groups");
      const tasks = await get("SELECT COUNT(*) AS c FROM tasks");
      const submissions = await get("SELECT COUNT(*) AS c FROM submissions");
      return res.json({ users:users.c, groups:groups.c, tasks:tasks.c, submissions:submissions.c });
    }
    if (req.user.role === "teacher") {
      const tasks = await get("SELECT COUNT(*) AS c FROM tasks WHERE created_by=?", [req.user.id]);
      const submissions = await get("SELECT COUNT(*) AS c FROM submissions");
      const students = await get("SELECT COUNT(*) AS c FROM users WHERE role='student'");
      const tests = await get("SELECT COUNT(*) AS c FROM tests WHERE created_by=?", [req.user.id]);
      return res.json({ tasks:tasks.c, submissions:submissions.c, students:students.c, tests:tests.c });
    }
    const groupParam = [req.user.group_id];
    const tasks = await get("SELECT COUNT(*) AS c FROM tasks WHERE group_id=? OR group_id IS NULL", groupParam);
    const submitted = await get("SELECT COUNT(*) AS c FROM submissions WHERE student_id=?", [req.user.id]);
    const avg = await get("SELECT ROUND(AVG(grade),1) AS c FROM submissions WHERE student_id=? AND grade IS NOT NULL", [req.user.id]);
    const attempts = await get("SELECT ROUND(AVG(percent),1) AS c FROM test_attempts WHERE student_id=?", [req.user.id]);
    res.json({ tasks:tasks.c, submitted:submitted.c, avg_grade:avg.c||0, test_avg:attempts.c||0 });
  } catch(e) { res.status(500).json({ error:"Database error" }); }
});

app.get("/api/groups", authUser, async (_, res) => {
  try { res.json(await all("SELECT * FROM groups ORDER BY id DESC")); } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.post("/api/groups", authUser, role("admin"), async (req, res) => {
  try {
    const r = await run("INSERT INTO groups(name,curator) VALUES(?,?)", [req.body.name, req.body.curator||""]);
    await log(req.user.id, "create_group", req.body.name);
    res.json({ id:r.lastID });
  } catch(e){ res.status(400).json({error:"Group exists or invalid"}); }
});

app.get("/api/users", authUser, role("admin","teacher"), async (req, res) => {
  try {
    const rows = await all("SELECT u.id,u.login,u.role,u.name,u.email,u.approved,g.name AS group_name,u.group_id FROM users u LEFT JOIN groups g ON g.id=u.group_id ORDER BY u.id DESC");
    res.json(rows);
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.patch("/api/users/:id/approve", authUser, role("admin"), async (req, res) => {
  try {
    await run("UPDATE users SET approved=1 WHERE id=?", [req.params.id]);
    await notify({ userId:req.params.id, title:"Аккаунт подтверждён", text:"Теперь вы можете пользоваться порталом" });
    await log(req.user.id, "approve_user", String(req.params.id));
    res.json({ ok:true });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/subjects", authUser, async (req, res) => {
  try {
    let rows;
    if (req.user.role === "student") {
      rows = await all(`SELECT s.*, g.name AS group_name, u.name AS teacher_name
        FROM subjects s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN users u ON u.id=s.teacher_id
        WHERE s.group_id=? OR s.group_id IS NULL ORDER BY s.id DESC`, [req.user.group_id]);
    } else {
      rows = await all(`SELECT s.*, g.name AS group_name, u.name AS teacher_name
        FROM subjects s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN users u ON u.id=s.teacher_id ORDER BY s.id DESC`);
    }
    res.json(rows);
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.post("/api/subjects", authUser, role("admin","teacher"), async (req, res) => {
  try {
    const teacherId = req.user.role === "teacher" ? req.user.id : (req.body.teacher_id || req.user.id);
    const r = await run("INSERT INTO subjects(title,teacher_id,group_id,description,credits) VALUES(?,?,?,?,?)", [req.body.title, teacherId, req.body.group_id||null, req.body.description||"", req.body.credits||3]);
    await notify({ role:"student", title:"Новый предмет", text:req.body.title });
    await log(req.user.id, "create_subject", req.body.title);
    res.json({ id:r.lastID });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/tasks", authUser, async (req, res) => {
  try {
    let sql = `SELECT t.*, s.title AS subject_title, g.name AS group_name,
      sub.id AS submission_id, sub.answer, sub.file_path AS answer_file, sub.status,
      sub.grade, sub.teacher_comment, sub.submitted_at
      FROM tasks t
      LEFT JOIN subjects s ON s.id=t.subject_id
      LEFT JOIN groups g ON g.id=t.group_id
      LEFT JOIN submissions sub ON sub.task_id=t.id AND sub.student_id=?`;
    const params = [req.user.id];
    if (req.user.role === "student") {
      sql += " WHERE t.group_id=? OR t.group_id IS NULL";
      params.push(req.user.group_id);
    }
    sql += " ORDER BY t.id DESC";
    res.json(await all(sql, params));
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.post("/api/tasks", authUser, role("admin","teacher"), upload.fields([{name:"taskFile",maxCount:1},{name:"taskPhoto",maxCount:1}]), async (req, res) => {
  try {
    const file = req.files?.taskFile ? "/uploads/" + req.files.taskFile[0].filename : null;
    const photo = req.files?.taskPhoto ? "/uploads/" + req.files.taskPhoto[0].filename : null;
    const r = await run(`INSERT INTO tasks(title,subject_id,group_id,description,deadline,created_by,file_path,photo_path)
      VALUES(?,?,?,?,?,?,?,?)`, [req.body.title, req.body.subject_id||null, req.body.group_id||null, req.body.description||"", req.body.deadline||"", req.user.id, file, photo]);
    await notify({ role:"student", title:"Новое задание", text:req.body.title });
    await log(req.user.id, "create_task", req.body.title);
    res.json({ id:r.lastID });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.delete("/api/tasks/:id", authUser, role("admin","teacher"), async (req, res) => {
  try {
    await run("DELETE FROM submissions WHERE task_id=?", [req.params.id]);
    await run("DELETE FROM tasks WHERE id=?", [req.params.id]);
    await log(req.user.id, "delete_task", String(req.params.id));
    res.json({ ok:true });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.post("/api/tasks/:id/submit", authUser, role("student"), upload.single("file"), async (req, res) => {
  try {
    const file = req.file ? "/uploads/" + req.file.filename : null;
    await run(`INSERT INTO submissions(task_id,student_id,answer,file_path,status)
      VALUES(?,?,?,?,'submitted')
      ON CONFLICT(task_id,student_id) DO UPDATE SET answer=excluded.answer,file_path=COALESCE(excluded.file_path,submissions.file_path),status='submitted',submitted_at=CURRENT_TIMESTAMP`, [req.params.id, req.user.id, req.body.answer||"", file]);
    await notify({ role:"teacher", title:"Студент сдал работу", text:`${req.user.name} отправил ответ` });
    await log(req.user.id, "submit_task", String(req.params.id));
    res.json({ ok:true });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/submissions", authUser, role("admin","teacher"), async (_, res) => {
  try {
    res.json(await all(`SELECT sub.*, u.name AS student_name, g.name AS group_name, t.title AS task_title, s.title AS subject_title
      FROM submissions sub
      JOIN users u ON u.id=sub.student_id
      LEFT JOIN groups g ON g.id=u.group_id
      JOIN tasks t ON t.id=sub.task_id
      LEFT JOIN subjects s ON s.id=t.subject_id
      ORDER BY sub.submitted_at DESC`));
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.patch("/api/submissions/:id/grade", authUser, role("admin","teacher"), async (req, res) => {
  try {
    const row = await get("SELECT student_id FROM submissions WHERE id=?", [req.params.id]);
    await run("UPDATE submissions SET grade=?, teacher_comment=? WHERE id=?", [req.body.grade, req.body.teacher_comment||"", req.params.id]);
    if (row) await notify({ userId:row.student_id, title:"Поставлена оценка", text:`Оценка: ${req.body.grade}` });
    await log(req.user.id, "grade_submission", String(req.params.id));
    res.json({ ok:true });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/tests", authUser, async (req, res) => {
  try {
    let sql = `SELECT tests.*, s.title AS subject_title, g.name AS group_name,
      a.id AS attempt_id, a.percent, a.score, a.total
      FROM tests
      LEFT JOIN subjects s ON s.id=tests.subject_id
      LEFT JOIN groups g ON g.id=tests.group_id
      LEFT JOIN test_attempts a ON a.test_id=tests.id AND a.student_id=?`;
    const params=[req.user.id];
    if (req.user.role === "student") { sql += " WHERE tests.group_id=? OR tests.group_id IS NULL"; params.push(req.user.group_id); }
    sql += " ORDER BY tests.id DESC";
    res.json(await all(sql, params));
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.get("/api/tests/:id", authUser, async (req, res) => {
  try {
    const test = await get("SELECT * FROM tests WHERE id=?", [req.params.id]);
    const questions = await all("SELECT id,question,a,b,c,d FROM questions WHERE test_id=?", [req.params.id]);
    res.json({ test, questions });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.post("/api/tests", authUser, role("admin","teacher"), async (req, res) => {
  try {
    const r = await run("INSERT INTO tests(title,subject_id,group_id,created_by) VALUES(?,?,?,?)", [req.body.title, req.body.subject_id||null, req.body.group_id||null, req.user.id]);
    for (const q of (req.body.questions || [])) {
      await run("INSERT INTO questions(test_id,question,a,b,c,d,correct) VALUES(?,?,?,?,?,?,?)", [r.lastID, q.question, q.a, q.b, q.c, q.d, q.correct]);
    }
    await notify({ role:"student", title:"Новый тест", text:req.body.title });
    await log(req.user.id, "create_test", req.body.title);
    res.json({ id:r.lastID });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.post("/api/tests/:id/submit", authUser, role("student"), async (req, res) => {
  try {
    const qs = await all("SELECT id,correct FROM questions WHERE test_id=?", [req.params.id]);
    let score = 0;
    const answers = req.body.answers || {};
    qs.forEach(q => { if (answers[q.id] === q.correct) score++; });
    const total = qs.length || 1;
    const percent = Math.round(score / total * 100);
    await run(`INSERT INTO test_attempts(test_id,student_id,score,total,percent,answers)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(test_id,student_id) DO UPDATE SET score=excluded.score,total=excluded.total,percent=excluded.percent,answers=excluded.answers,created_at=CURRENT_TIMESTAMP`,
      [req.params.id, req.user.id, score, total, percent, JSON.stringify(answers)]);
    await notify({ role:"teacher", title:"Тест пройден", text:`${req.user.name}: ${percent}%` });
    await log(req.user.id, "submit_test", `${req.params.id}: ${percent}%`);
    res.json({ score, total, percent });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/progress", authUser, async (req, res) => {
  try {
    const tasks = await get("SELECT COUNT(*) AS c FROM tasks WHERE group_id=? OR group_id IS NULL", [req.user.group_id]);
    const submissions = await get("SELECT COUNT(*) AS c FROM submissions WHERE student_id=?", [req.user.id]);
    const avgGrade = await get("SELECT ROUND(AVG(grade),1) AS c FROM submissions WHERE student_id=? AND grade IS NOT NULL", [req.user.id]);
    const testAvg = await get("SELECT ROUND(AVG(percent),1) AS c FROM test_attempts WHERE student_id=?", [req.user.id]);
    const donePercent = tasks.c ? Math.round(submissions.c / tasks.c * 100) : 0;
    const finalProgress = Math.round((donePercent + (avgGrade.c||0) + (testAvg.c||0)) / 3);
    res.json({ tasks:tasks.c, submissions:submissions.c, donePercent, avgGrade:avgGrade.c||0, testAvg:testAvg.c||0, finalProgress });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/notifications", authUser, async (req, res) => {
  try {
    res.json(await all("SELECT * FROM notifications WHERE user_id=? OR role=? OR role IS NULL ORDER BY id DESC LIMIT 30", [req.user.id, req.user.role]));
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.patch("/api/notifications/read", authUser, async (req, res) => {
  try { await run("UPDATE notifications SET is_read=1 WHERE user_id=? OR role=?", [req.user.id, req.user.role]); res.json({ok:true}); } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/messages", authUser, async (req, res) => {
  try {
    res.json(await all(`SELECT m.*, uf.name AS from_name, ut.name AS to_name
      FROM messages m
      LEFT JOIN users uf ON uf.id=m.from_user
      LEFT JOIN users ut ON ut.id=m.to_user
      WHERE m.from_user=? OR m.to_user=? OR m.to_role=?
      ORDER BY m.id DESC LIMIT 50`, [req.user.id, req.user.id, req.user.role]));
  } catch(e){ res.status(500).json({error:"Database error"}); }
});
app.post("/api/messages", authUser, async (req, res) => {
  try {
    const r = await run("INSERT INTO messages(from_user,to_user,to_role,text) VALUES(?,?,?,?)", [req.user.id, req.body.to_user||null, req.body.to_role||null, req.body.text]);
    if (req.body.to_user) await notify({ userId:req.body.to_user, title:"Новое сообщение", text:req.body.text });
    if (req.body.to_role) await notify({ role:req.body.to_role, title:"Новое сообщение", text:req.body.text });
    await log(req.user.id, "send_message", req.body.text.slice(0, 80));
    res.json({ id:r.lastID });
  } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/audit", authUser, role("admin"), async (_, res) => {
  try {
    res.json(await all(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100`));
  } catch(e){ res.status(500).json({error:"Database error"}); }
});

app.get("/api/export/submissions.csv", authUser, role("admin","teacher"), async (_, res) => {
  const rows = await all(`SELECT u.name AS student, g.name AS group_name, t.title AS task, s.title AS subject, sub.grade, sub.status, sub.submitted_at
    FROM submissions sub
    JOIN users u ON u.id=sub.student_id
    LEFT JOIN groups g ON g.id=u.group_id
    JOIN tasks t ON t.id=sub.task_id
    LEFT JOIN subjects s ON s.id=t.subject_id
    ORDER BY sub.submitted_at DESC`);
  const csv = ["Student,Group,Task,Subject,Grade,Status,Submitted At"]
    .concat(rows.map(r => [r.student,r.group_name,r.task,r.subject,r.grade,r.status,r.submitted_at].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")))
    .join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=submissions.csv");
  res.send("\ufeff" + csv);
});

app.get("/certificate/:userId", async (req, res) => {
  const u = await get("SELECT u.*, g.name AS group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.id=?", [req.params.userId]);
  if (!u) return res.status(404).send("Not found");
  const avg = await get("SELECT ROUND(AVG(grade),1) AS c FROM submissions WHERE student_id=? AND grade IS NOT NULL", [req.params.userId]);
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificate</title><style>
    body{font-family:Arial;background:#f3f6fb;margin:0;padding:40px}.cert{max-width:900px;margin:auto;background:white;border:12px solid #2563eb;padding:60px;text-align:center}
    h1{font-size:48px;color:#1d4ed8}.name{font-size:34px;font-weight:bold;margin:30px}.muted{color:#667085}.btn{margin-top:25px;padding:12px 18px;background:#2563eb;color:white;border-radius:10px;display:inline-block;cursor:pointer}
    @media print{.btn{display:none}}
  </style></head><body><div class="cert"><h1>СЕРТИФИКАТ</h1><p class="muted">Осы сертификат / настоящий сертификат подтверждает, что</p><div class="name">${u.name}</div><p>успешно прошёл обучение в группе <b>${u.group_name || "-"}</b></p><p>Средний балл: <b>${avg.c || 0}</b></p><p class="muted">${new Date().toLocaleDateString("ru-RU")}</p><button class="btn" onclick="window.print()">Печать / PDF</button></div></body></html>`);
});

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

init().then(() => {
  app.listen(PORT, "0.0.0.0", () => console.log(`Server started: http://localhost:${PORT}`));
}).catch(err => {
  console.error("Init error:", err);
  process.exit(1);
});

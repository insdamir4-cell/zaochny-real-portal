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

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const db = new sqlite3.Database(path.join(dataDir, "portal.db"));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\wа-яА-ЯёЁқҚғҒүҮұҰіІңҢөӨһҺ.\-]/g, "_");
    cb(null, Date.now() + "_" + safe);
  }
});
const upload = multer({ storage });

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      group_name TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      deadline TEXT,
      created_by INTEGER,
      file_path TEXT,
      photo_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user INTEGER,
      to_role TEXT,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run("ALTER TABLE tasks ADD COLUMN file_path TEXT", () => {});
  db.run("ALTER TABLE tasks ADD COLUMN photo_path TEXT", () => {});

  seed();
});

function seed() {
  const users = [
    ["teacher", "1234", "teacher", "Преподаватель", "IT кафедра"],
    ["student", "1234", "student", "Мерей Дениселам", "ЗО-23-1"],
    ["student2", "1234", "student", "Алихан Нурлан", "ЗО-23-1"]
  ];

  users.forEach(u => {
    db.run(
      `
        INSERT INTO users(login, password, role, name, group_name)
        VALUES(?,?,?,?,?)
        ON CONFLICT(login)
        DO UPDATE SET
          password = excluded.password,
          role = excluded.role,
          name = excluded.name,
          group_name = excluded.group_name
      `,
      u
    );
  });

  db.get("SELECT COUNT(*) AS count FROM tasks", [], (err, row) => {
    if (!err && row.count === 0) {
      db.run(
        "INSERT INTO tasks(title, subject, description, deadline, created_by) VALUES(?,?,?,?,?)",
        [
          "Практическая работа №1",
          "Web Development",
          "Сделать HTML/CSS страницу и отправить ответ.",
          "2026-05-10",
          1
        ]
      );
      db.run(
        "INSERT INTO tasks(title, subject, description, deadline, created_by) VALUES(?,?,?,?,?)",
        [
          "SQL тапсырмасы",
          "Database Systems",
          "SELECT, WHERE, JOIN бойынша 10 сұраққа жауап беріңіз.",
          "2026-05-15",
          1
        ]
      );
    }
  });
}

function authUser(req, res, next) {
  const userId = Number(req.headers["x-user-id"]);
  if (!userId) return res.status(401).json({ error: "No user id" });

  db.get("SELECT id, login, role, name, group_name FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(401).json({ error: "Invalid user" });
    req.user = user;
    next();
  });
}

function onlyTeacher(req, res, next) {
  if (req.user.role !== "teacher") return res.status(403).json({ error: "Only teacher can do this" });
  next();
}

app.post("/api/login", (req, res) => {
  const { login, password } = req.body;
  db.get(
    "SELECT id, login, role, name, group_name FROM users WHERE login = ? AND password = ?",
    [login, password],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });
      res.json(user);
    }
  );
});

app.get("/api/me", authUser, (req, res) => {
  res.json(req.user);
});

app.get("/api/tasks", authUser, (req, res) => {
  const sql = `
    SELECT 
      t.*,
      s.id AS submission_id,
      s.answer,
      s.file_path,
      s.status,
      s.grade,
      s.teacher_comment,
      s.submitted_at
    FROM tasks t
    LEFT JOIN submissions s 
      ON s.task_id = t.id AND s.student_id = ?
    ORDER BY t.id DESC
  `;

  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(rows);
  });
});

app.post("/api/tasks", authUser, onlyTeacher, upload.fields([
  { name: "taskFile", maxCount: 1 },
  { name: "taskPhoto", maxCount: 1 }
]), (req, res) => {
  const { title, subject, description, deadline } = req.body;
  if (!title || !subject) return res.status(400).json({ error: "Title and subject are required" });

  const taskFile = req.files && req.files.taskFile ? "/uploads/" + req.files.taskFile[0].filename : null;
  const taskPhoto = req.files && req.files.taskPhoto ? "/uploads/" + req.files.taskPhoto[0].filename : null;

  db.run(
    "INSERT INTO tasks(title, subject, description, deadline, created_by, file_path, photo_path) VALUES(?,?,?,?,?,?,?)",
    [title, subject, description || "", deadline || "", req.user.id, taskFile, taskPhoto],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ id: this.lastID, message: "Task created", file_path: taskFile, photo_path: taskPhoto });
    }
  );
});

app.delete("/api/tasks/:id", authUser, onlyTeacher, (req, res) => {
  db.run("DELETE FROM submissions WHERE task_id = ?", [req.params.id], err => {
    if (err) return res.status(500).json({ error: "Database error" });

    db.run("DELETE FROM tasks WHERE id = ?", [req.params.id], err2 => {
      if (err2) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Task deleted" });
    });
  });
});

app.post("/api/tasks/:id/submit", authUser, upload.single("file"), (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ error: "Only student can submit tasks" });
  }

  const taskId = Number(req.params.id);
  const answer = req.body.answer || "";
  const filePath = req.file ? "/uploads/" + req.file.filename : null;

  db.run(
    `
      INSERT INTO submissions(task_id, student_id, answer, file_path, status)
      VALUES(?,?,?,?, 'submitted')
      ON CONFLICT(task_id, student_id)
      DO UPDATE SET
        answer = excluded.answer,
        file_path = COALESCE(excluded.file_path, submissions.file_path),
        status = 'submitted',
        submitted_at = CURRENT_TIMESTAMP
    `,
    [taskId, req.user.id, answer, filePath],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Submitted" });
    }
  );
});

app.get("/api/submissions", authUser, onlyTeacher, (req, res) => {
  const sql = `
    SELECT 
      s.*,
      u.name AS student_name,
      u.group_name,
      t.title AS task_title,
      t.subject
    FROM submissions s
    JOIN users u ON u.id = s.student_id
    JOIN tasks t ON t.id = s.task_id
    ORDER BY s.submitted_at DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(rows);
  });
});

app.patch("/api/submissions/:id/grade", authUser, onlyTeacher, (req, res) => {
  const { grade, teacher_comment } = req.body;
  db.run(
    "UPDATE submissions SET grade = ?, teacher_comment = ? WHERE id = ?",
    [grade, teacher_comment || "", req.params.id],
    err => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Grade saved" });
    }
  );
});

app.get("/api/stats", authUser, (req, res) => {
  if (req.user.role === "teacher") {
    db.get("SELECT COUNT(*) AS tasks FROM tasks", [], (e1, a) => {
      db.get("SELECT COUNT(*) AS submissions FROM submissions", [], (e2, b) => {
        db.get("SELECT COUNT(*) AS students FROM users WHERE role = 'student'", [], (e3, c) => {
          if (e1 || e2 || e3) return res.status(500).json({ error: "Database error" });
          res.json({ tasks: a.tasks, submissions: b.submissions, students: c.students });
        });
      });
    });
  } else {
    db.get("SELECT COUNT(*) AS tasks FROM tasks", [], (e1, a) => {
      db.get("SELECT COUNT(*) AS submitted FROM submissions WHERE student_id = ?", [req.user.id], (e2, b) => {
        db.get("SELECT ROUND(AVG(grade), 1) AS avg_grade FROM submissions WHERE student_id = ? AND grade IS NOT NULL", [req.user.id], (e3, c) => {
          if (e1 || e2 || e3) return res.status(500).json({ error: "Database error" });
          res.json({ tasks: a.tasks, submitted: b.submitted, avg_grade: c.avg_grade || 0 });
        });
      });
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started: http://localhost:${PORT}`);
});

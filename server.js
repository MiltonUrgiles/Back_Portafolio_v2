const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: (_, file, cb) => cb(null, 'uploads/'),
  filename: (_, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// 📌 DB SQLite para ejemplo simple
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pdfs.db');

// Crear tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS pdfs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT,
  categoria TEXT,
  parcial TEXT,
  ruta TEXT
)`);

// Subir PDF
app.post('/upload', upload.single('pdf'), (req, res) => {
  const { categoria, parcial } = req.body;
  const nombre = req.file.originalname;
  const ruta = req.file.path;

  db.run('INSERT INTO pdfs (nombre, categoria, parcial, ruta) VALUES (?, ?, ?, ?)', [nombre, categoria, parcial, ruta], function(err) {
    if (err) return res.sendStatus(500);
    res.json({ id: this.lastID });
  });
});

// Obtener PDFs por parcial y categoría
app.get('/pdfs', (req, res) => {
  const { parcial, categoria } = req.query;
  db.all('SELECT * FROM pdfs WHERE parcial = ? AND categoria = ?', [parcial, categoria], (err, rows) => {
    if (err) return res.sendStatus(500);
    res.json(rows);
  });
});

// Eliminar PDF
app.delete('/pdfs/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT ruta FROM pdfs WHERE id = ?', [id], (err, row) => {
    if (!row) return res.sendStatus(404);
    fs.unlinkSync(row.ruta);
    db.run('DELETE FROM pdfs WHERE id = ?', [id], err => {
      if (err) return res.sendStatus(500);
      res.sendStatus(200);
    });
  });
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));

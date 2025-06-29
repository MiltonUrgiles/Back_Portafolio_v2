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
  const ruta = req.file.path.replace(/\\/g, '/');

  db.run(
    'INSERT INTO pdfs (nombre, categoria, parcial, ruta) VALUES (?, ?, ?, ?)',
    [nombre, categoria, parcial, ruta],
    function(err) {
      if (err) return res.sendStatus(500);
      res.json({ id: this.lastID });
    }
  );
});

// Obtener PDFs por parcial y categoría con reparación UTF-8 en nombres
app.get('/pdfs', (req, res) => {
  const { parcial, categoria } = req.query;
  db.all(
    'SELECT * FROM pdfs WHERE parcial = ? AND categoria = ?',
    [parcial, categoria],
    (err, rows) => {
      if (err) return res.sendStatus(500);

      // Reparar nombres corruptos (de latin1 a utf8)
      rows = rows.map(row => ({
        ...row,
        nombre: Buffer.from(row.nombre, 'latin1').toString('utf8'),
        ruta: row.ruta.replace(/\\/g, '/'), // aseguramos barras /
      }));

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(rows);
    }
  );
});

// Eliminar PDF (asegurar ruta correcta y manejo de errores)
app.delete('/pdfs/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT ruta FROM pdfs WHERE id = ?', [id], (err, row) => {
    if (err) return res.sendStatus(500);
    if (!row) return res.sendStatus(404);

    const filePath = path.resolve(row.ruta.replace(/\//g, path.sep)); // ruta absoluta y correcta
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error eliminando archivo:', unlinkErr);
        return res.sendStatus(500);
      }
      db.run('DELETE FROM pdfs WHERE id = ?', [id], err => {
        if (err) return res.sendStatus(500);
        res.sendStatus(200);
      });
    });
  });
});

app.listen(PORT, () => console.log(`Server corriendo en http://localhost:${PORT}`));

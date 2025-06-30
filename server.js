const express = require('express');
const multer = require('multer');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Multer en memoria
const upload = multer({ storage: multer.memoryStorage() });

const dbConfig = {
  user: 'Sachi_SQLLogin_3',
  password: '912fnf1g7h',
  server: 'portafodb.mssql.somee.com',
  database: 'portafodb',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

// Subir PDF
app.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });

  const { categoria, parcial } = req.body;
  const nombre = req.file.originalname;
  const archivo = req.file.buffer;
  const tipo = req.file.mimetype;

  try {
    const pool = await getPool();
    await pool.request()
      .input('Nombre', sql.NVarChar, nombre)
      .input('Categoria', sql.NVarChar, categoria)
      .input('Parcial', sql.NVarChar, parcial)
      .input('Archivo', sql.VarBinary(sql.MAX), archivo)
      .input('Tipo', sql.NVarChar, tipo)
      .query(`
        INSERT INTO Pdfs (Nombre, Categoria, Parcial, Archivo, Tipo)
        VALUES (@Nombre, @Categoria, @Parcial, @Archivo, @Tipo)
      `);

    res.status(200).json({ message: 'PDF guardado en SQL Server correctamente' });
  } catch (err) {
    console.error('Error al guardar en SQL Server:', err);
    res.sendStatus(500);
  }
});

// Obtener PDFs (metadatos)
app.get('/pdfs', async (req, res) => {
  const { parcial, categoria } = req.query;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Parcial', sql.NVarChar, parcial)
      .input('Categoria', sql.NVarChar, categoria)
      .query(`
        SELECT Id, Nombre, Categoria, Parcial, Tipo FROM Pdfs
        WHERE Parcial = @Parcial AND Categoria = @Categoria
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error al obtener PDFs:', err);
    res.sendStatus(500);
  }
});

// Descargar PDF por ID
app.get('/pdfs/:id/download', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT Nombre, Archivo, Tipo FROM Pdfs WHERE Id = @Id');

    if (result.recordset.length === 0) return res.sendStatus(404);

    const { Nombre, Archivo, Tipo } = result.recordset[0];
    res.setHeader('Content-Disposition', `attachment; filename="${Nombre}"`);
    res.setHeader('Content-Type', Tipo);
    res.send(Archivo);
  } catch (err) {
    console.error('Error al descargar PDF:', err);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => console.log(`Servidor corriendo en http://ngroc:${PORT}`));

const express = require('express');
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const { createClient } = require('redis');

const app = express();
const version = process.env.APP_VERSION || '1.0.0';

app.get('/', (req, res) => res.json({
  mensaje: 'Aplicación desplegada con Dokploy',
  version,
  nombre: 'María José Vásquez Beltrán',
  codigo: '1092456048',
  institucion: 'Universidad del Quindío'
}));

app.get('/health', (req, res) => res.json({
  estado: 'saludable',
  version,
  uptime: process.uptime()
}));

app.get('/info', (req, res) => res.json({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  memoria: process.memoryUsage()
}));

app.get('/db', async (req, res) => {
  let db;
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 5000
    });

    await db.execute(`CREATE TABLE IF NOT EXISTS estudiante (
      codigo VARCHAR(20) PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL
    )`);

    await db.execute('REPLACE INTO estudiante VALUES (?, ?)',
      ['1092456048', 'María José Vásquez Beltrán']);

    const [filas] = await db.execute('SELECT * FROM estudiante');
    res.json({mysql: 'conexión exitosa', filas});
  } catch (e) {
    console.error('MySQL:', e.code || e.message);
    res.status(503).json({mysql: 'error de conexión'});
  } finally {
    if (db) await db.end();
  }
});
app.get('/postgres', async (req, res) => {
  const db = new Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    connectionTimeoutMillis: 5000
  });

  try {
    await db.connect();
    const r = await db.query('SELECT current_database() AS base');
    res.json({
      postgres: 'conexión exitosa',
      resultado: r.rows
    });
  } catch (e) {
    console.error('PostgreSQL:', e.code || e.message);
    res.status(503).json({postgres: 'error de conexión'});
  } finally {
    await db.end().catch(() => {});
  }
});

app.get('/redis', async (req, res) => {
  const db = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
      connectTimeout: 5000,
      reconnectStrategy: false
    },
    password: process.env.REDIS_PASSWORD
  });

  db.on('error', e => console.error('Redis:', e.message));

  try {
    await db.connect();
    await db.set('estudiante', '1092456048');
    res.json({
      redis: 'conexión exitosa',
      codigo: await db.get('estudiante')
    });
  } catch (e) {
    res.status(503).json({redis: 'error de conexión'});
  } finally {
    if (db.isOpen) await db.disconnect();
  }
});

app.listen(Number(process.env.PORT || 3000), '0.0.0.0',
  () => console.log('Aplicación Dokploy versión ' + version));

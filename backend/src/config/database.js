const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'manager',
  database: process.env.DB_NAME || 'shopping_mall_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true
};

const pool = mysql.createPool(dbConfig);

// Helper for transaction execution
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Check database connectivity
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Connected successfully to MySQL (${dbConfig.host}:${dbConfig.port}/${dbConfig.database})`);
    connection.release();
    return true;
  } catch (error) {
    console.warn(`[Database] Warning: Could not connect to MySQL: ${error.message}`);
    console.warn(`[Database] Please ensure MySQL service is running and database '${dbConfig.database}' is imported from shopping_mall.sql`);
    return false;
  }
}

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  execute: (sql, params) => pool.execute(sql, params),
  getConnection: () => pool.getConnection(),
  withTransaction,
  testConnection
};

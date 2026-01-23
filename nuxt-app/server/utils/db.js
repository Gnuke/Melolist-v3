import mysql from 'mysql2/promise';

let pool;

export const getDbPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: '125.133.91.90',
      port: 3400,
      user: 'webmaster',
      password: '12345',
      database: 'webdev',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
};


const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Paraunfuturomejor@28',
  database: 'sass_taller'
});

module.exports = pool.promise();



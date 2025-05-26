import "../bootstrap";

module.exports = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin"
  },
  dialect: process.env.DB_DIALECT || "postgres",
  timezone: "-03:00",

  host: '195.26.250.186',
  port: 5442 || 3306,
  database: 'tzsexpertacademy' || process.env.DB_NAME,
  username: 'tzsexpertacademy' || process.env.DB_USER,
  password: '123456' || process.env.DB_PASS,
  logging: process.env.DB_DEBUG === "true",
  pool: {
    max: 800, // Máximo de conexões no pool (ideal para 6 núcleos e ambiente multitarefa)
    min: 0, // Mínimo de conexões no pool
    acquire: 30000, // Tempo máximo para obter uma conexão (30 segundos)
    idle: 10000 // Tempo para liberar conexões inativas (10 segundos)
  },
};



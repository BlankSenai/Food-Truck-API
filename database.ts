import Database from 'better-sqlite3'

// Conexão com o SQLite no arquivo dados.db na raiz
const db = new Database('dados.db')

// WAL para melhor concorrência e foreign_keys para validar as FKs
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Cria as 4 tabelas na ordem de dependência das chaves estrangeiras
export function inicializarBanco() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS pratos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      preco REAL NOT NULL,
      categoria_id INTEGER NOT NULL,
      disponivel INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      prato_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (prato_id) REFERENCES pratos(id)
    )
  `)
}

export default db

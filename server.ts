import express from 'express'
import db, { inicializarBanco } from './database.js'

// Cria as tabelas antes de subir o servidor
inicializarBanco()

const app = express()
app.use(express.json())

// ===== CATEGORIAS E PRATOS =====

type PratoValidado = {
  nome: string
  preco: number
  categoria_id: number
  disponivel: number
}

// Valida os dados de um prato (usado no create e no PUT)
function validarPrato(body: any): { erro: string } | { dados: PratoValidado } {
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''

  if (!nome) {
    return { erro: 'nome é obrigatório' }
  }

  const preco = Number(body?.preco)

  if (!Number.isFinite(preco) || preco <= 0) {
    return { erro: 'preco deve ser um número maior que zero' }
  }

  if (!/^\d+$/.test(String(body?.categoria_id))) {
    return { erro: 'categoria_id inválido' }
  }

  const categoria = db
    .prepare('SELECT id FROM categorias WHERE id = ?')
    .get(body.categoria_id)

  if (!categoria) {
    return { erro: 'categoria_id inexistente' }
  }

  let disponivel = 1

  if (body?.disponivel !== undefined) {
    if (![0, 1, true, false].includes(body.disponivel)) {
      return { erro: 'disponivel deve ser 0 ou 1' }
    }

    disponivel = body.disponivel ? 1 : 0
  }

  return {
    dados: {
      nome,
      preco,
      categoria_id: Number(body.categoria_id),
      disponivel
    }
  }
}

// ----- Categorias -----

// Cria categoria com nome sanitizado
app.post('/api/categorias', (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : ''

  if (!nome) {
    return res.status(400).json({ erro: 'nome é obrigatório' })
  }

  const info = db
    .prepare('INSERT INTO categorias (nome) VALUES (?)')
    .run(nome)

  const categoria = db
    .prepare('SELECT * FROM categorias WHERE id = ?')
    .get(info.lastInsertRowid)

  res.status(201).json(categoria)
})

// Lista categorias, com busca opcional por nome
app.get('/api/categorias', (req, res) => {
  const { search } = req.query

  if (typeof search === 'string' && search.length > 0) {
    const encontradas = db
      .prepare('SELECT * FROM categorias WHERE nome LIKE ?')
      .all(`%${search}%`)

    return res.json(encontradas)
  }

  res.json(db.prepare('SELECT * FROM categorias').all())
})

// Substitui o nome da categoria
app.put('/api/categorias/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'id inválido' })
  }

  const categoria = db
    .prepare('SELECT * FROM categorias WHERE id = ?')
    .get(req.params.id)

  if (!categoria) {
    return res.status(404).json({ erro: 'categoria não encontrada' })
  }

  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : ''

  if (!nome) {
    return res.status(400).json({ erro: 'nome é obrigatório' })
  }

  db.prepare('UPDATE categorias SET nome = ? WHERE id = ?').run(nome, req.params.id)

  const atualizada = db
    .prepare('SELECT * FROM categorias WHERE id = ?')
    .get(req.params.id)

  res.json(atualizada)
})

// Atualiza parcialmente a categoria
app.patch('/api/categorias/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'id inválido' })
  }

  const categoria = db
    .prepare('SELECT * FROM categorias WHERE id = ?')
    .get(req.params.id)

  if (!categoria) {
    return res.status(404).json({ erro: 'categoria não encontrada' })
  }

  if (req.body?.nome === undefined) {
    return res.status(400).json({ erro: 'nenhum campo para atualizar' })
  }

  const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : ''

  if (!nome) {
    return res.status(400).json({ erro: 'nome inválido' })
  }

  const atualizar = db.transaction(() => {
    db.prepare('UPDATE categorias SET nome = ? WHERE id = ?').run(nome, req.params.id)
  })

  atualizar()

  const atualizada = db
    .prepare('SELECT * FROM categorias WHERE id = ?')
    .get(req.params.id)

  res.json(atualizada)
})

// Remove categoria, bloqueando se houver pratos vinculados
app.delete('/api/categorias/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'id inválido' })
  }

  const categoria = db
    .prepare('SELECT * FROM categorias WHERE id = ?')
    .get(req.params.id)

  if (!categoria) {
    return res.status(404).json({ erro: 'categoria não encontrada' })
  }

  const vinculados = db
    .prepare('SELECT COUNT(*) AS total FROM pratos WHERE categoria_id = ?')
    .get(req.params.id) as { total: number }

  if (vinculados.total > 0) {
    return res.status(400).json({ erro: 'categoria possui pratos vinculados' })
  }

  db.prepare('DELETE FROM categorias WHERE id = ?').run(req.params.id)

  res.json(categoria)
})

// ----- Pratos -----

// Cria prato validando preço e categoria
app.post('/api/pratos', (req, res) => {
  const r = validarPrato(req.body)

  if ('erro' in r) {
    return res.status(400).json({ erro: r.erro })
  }

  const { nome, preco, categoria_id, disponivel } = r.dados

  const info = db
    .prepare('INSERT INTO pratos (nome, preco, categoria_id, disponivel) VALUES (?, ?, ?, ?)')
    .run(nome, preco, categoria_id, disponivel)

  const prato = db
    .prepare('SELECT * FROM pratos WHERE id = ?')
    .get(info.lastInsertRowid)

  res.status(201).json(prato)
})

// Lista pratos, com busca opcional por nome
app.get('/api/pratos', (req, res) => {
  const { search } = req.query

  if (typeof search === 'string' && search.length > 0) {
    const encontrados = db
      .prepare('SELECT * FROM pratos WHERE nome LIKE ?')
      .all(`%${search}%`)

    return res.json(encontrados)
  }

  res.json(db.prepare('SELECT * FROM pratos').all())
})

// Substitui todos os campos do prato
app.put('/api/pratos/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'id inválido' })
  }

  const prato = db
    .prepare('SELECT * FROM pratos WHERE id = ?')
    .get(req.params.id)

  if (!prato) {
    return res.status(404).json({ erro: 'prato não encontrado' })
  }

  const r = validarPrato(req.body)

  if ('erro' in r) {
    return res.status(400).json({ erro: r.erro })
  }

  const { nome, preco, categoria_id, disponivel } = r.dados

  db
    .prepare('UPDATE pratos SET nome = ?, preco = ?, categoria_id = ?, disponivel = ? WHERE id = ?')
    .run(nome, preco, categoria_id, disponivel, req.params.id)

  const atualizado = db
    .prepare('SELECT * FROM pratos WHERE id = ?')
    .get(req.params.id)

  res.json(atualizado)
})

// Atualiza parcialmente o prato, validando cada campo enviado
app.patch('/api/pratos/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'id inválido' })
  }

  const prato = db
    .prepare('SELECT * FROM pratos WHERE id = ?')
    .get(req.params.id)

  if (!prato) {
    return res.status(404).json({ erro: 'prato não encontrado' })
  }

  const campos: string[] = []
  const valores: any[] = []

  if (req.body?.nome !== undefined) {
    const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : ''

    if (!nome) {
      return res.status(400).json({ erro: 'nome inválido' })
    }

    campos.push('nome = ?')
    valores.push(nome)
  }

  if (req.body?.preco !== undefined) {
    const preco = Number(req.body.preco)

    if (!Number.isFinite(preco) || preco <= 0) {
      return res.status(400).json({ erro: 'preco deve ser um número maior que zero' })
    }

    campos.push('preco = ?')
    valores.push(preco)
  }

  if (req.body?.categoria_id !== undefined) {
    if (!/^\d+$/.test(String(req.body.categoria_id))) {
      return res.status(400).json({ erro: 'categoria_id inválido' })
    }

    const categoria = db
      .prepare('SELECT id FROM categorias WHERE id = ?')
      .get(req.body.categoria_id)

    if (!categoria) {
      return res.status(400).json({ erro: 'categoria_id inexistente' })
    }

    campos.push('categoria_id = ?')
    valores.push(Number(req.body.categoria_id))
  }

  if (req.body?.disponivel !== undefined) {
    if (![0, 1, true, false].includes(req.body.disponivel)) {
      return res.status(400).json({ erro: 'disponivel deve ser 0 ou 1' })
    }

    campos.push('disponivel = ?')
    valores.push(req.body.disponivel ? 1 : 0)
  }

  if (campos.length === 0) {
    return res.status(400).json({ erro: 'nenhum campo para atualizar' })
  }

  const atualizar = db.transaction(() => {
    db
      .prepare(`UPDATE pratos SET ${campos.join(', ')} WHERE id = ?`)
      .run(...valores, req.params.id)
  })

  atualizar()

  const atualizado = db
    .prepare('SELECT * FROM pratos WHERE id = ?')
    .get(req.params.id)

  res.json(atualizado)
})

// Remove prato
app.delete('/api/pratos/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ erro: 'id inválido' })
  }

  const prato = db
    .prepare('SELECT * FROM pratos WHERE id = ?')
    .get(req.params.id)

  if (!prato) {
    return res.status(404).json({ erro: 'prato não encontrado' })
  }

  db.prepare('DELETE FROM pratos WHERE id = ?').run(req.params.id)

  res.json(prato)
})

// ===== CLIENTES E PEDIDOS =====

app.listen(3000, () => {
  console.log('API rodando em http://localhost:3000')
})

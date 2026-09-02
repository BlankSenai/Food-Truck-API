import express from 'express'
import db, { inicializarBanco } from './database.js'

// Cria as tabelas antes de subir o servidor
inicializarBanco()

const app = express()
app.use(express.json())

// Garante um body objeto para as rotas não quebrarem quando ele vier ausente
app.use((req, _res, next) => {
  if (!req.body || typeof req.body !== 'object') req.body = {}
  next()
})

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

function texto(valor: any) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function idNumerico(valor: any) {
  return /^\d+$/.test(String(valor))
}

// --- CLIENTES ---

app.post('/api/clientes', (req: express.Request, res: express.Response) => {
  const nome = texto(req.body.nome)
  const telefone = texto(req.body.telefone)
  if (!nome || !telefone) {
    return res.status(400).json({ erro: 'nome e telefone são obrigatórios' })
  }
  const stmt = db.prepare('INSERT INTO clientes (nome, telefone) VALUES (?, ?)')
  const info = stmt.run(nome, telefone)
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(cliente)
})

app.get('/api/clientes', (req: express.Request, res: express.Response) => {
  const search = req.query.search
  if (search) {
    const stmt = db.prepare('SELECT * FROM clientes WHERE nome LIKE ?')
    res.json(stmt.all(`%${search}%`))
  } else {
    const stmt = db.prepare('SELECT * FROM clientes')
    res.json(stmt.all())
  }
})

app.put('/api/clientes/:id', (req: express.Request, res: express.Response) => {
  if (!idNumerico(req.params.id)) return res.status(400).json({ erro: 'id inválido' })
  const id = Number(req.params.id)
  
  const nome = texto(req.body.nome)
  const telefone = texto(req.body.telefone)
  if (!nome || !telefone) {
    return res.status(400).json({ erro: 'nome e telefone são obrigatórios' })
  }

  const stmt = db.prepare('UPDATE clientes SET nome = ?, telefone = ? WHERE id = ?')
  const info = stmt.run(nome, telefone, id)
  if (info.changes === 0) return res.status(404).json({ erro: 'cliente não encontrado' })

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id)
  res.json(cliente)
})

app.patch('/api/clientes/:id', (req: express.Request, res: express.Response) => {
  if (!idNumerico(req.params.id)) return res.status(400).json({ erro: 'id inválido' })
  const id = Number(req.params.id)
  
  const campos: string[] = []
  const valores: any[] = []
  
  if (req.body.nome !== undefined) {
    const nome = texto(req.body.nome)
    if (!nome) return res.status(400).json({ erro: 'nome inválido' })
    campos.push('nome = ?')
    valores.push(nome)
  }
  
  if (req.body.telefone !== undefined) {
    const telefone = texto(req.body.telefone)
    if (!telefone) return res.status(400).json({ erro: 'telefone inválido' })
    campos.push('telefone = ?')
    valores.push(telefone)
  }
  
  if (campos.length === 0) return res.status(400).json({ erro: 'nenhum campo enviado' })
  
  valores.push(id)
  
  const atualizar = db.transaction(() => {
    const info = db.prepare(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    if (info.changes === 0) return null
    return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id)
  })
  
  const cliente = atualizar()
  if (!cliente) return res.status(404).json({ erro: 'cliente não encontrado' })
  
  res.json(cliente)
})

app.delete('/api/clientes/:id', (req: express.Request, res: express.Response) => {
  if (!idNumerico(req.params.id)) return res.status(400).json({ erro: 'id inválido' })
  const id = Number(req.params.id)
  
  const pedidoVinculado = db.prepare('SELECT id FROM pedidos WHERE cliente_id = ?').get(id)
  if (pedidoVinculado) return res.status(400).json({ erro: 'cliente possui pedidos vinculados' })
  
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id)
  if (!cliente) return res.status(404).json({ erro: 'cliente não encontrado' })

  db.prepare('DELETE FROM clientes WHERE id = ?').run(id)
  
  res.json(cliente)
})

// --- PEDIDOS ---

app.post('/api/pedidos', (req: express.Request, res: express.Response) => {
  const { cliente_id, prato_id, status = 'pendente' } = req.body
  const quantidade = Number(req.body.quantidade)
  
  if (!idNumerico(cliente_id) || !idNumerico(prato_id)) {
    return res.status(400).json({ erro: 'cliente_id e prato_id devem ser numéricos' })
  }
  
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    return res.status(400).json({ erro: 'quantidade inválida' })
  }
  
  if (!['pendente', 'preparando', 'entregue'].includes(status)) {
    return res.status(400).json({ erro: 'status inválido' })
  }
  
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id)
  if (!cliente) return res.status(400).json({ erro: 'cliente não encontrado' })
  
  const prato = db.prepare('SELECT id FROM pratos WHERE id = ?').get(prato_id)
  if (!prato) return res.status(400).json({ erro: 'prato não encontrado' })
  
  const stmt = db.prepare('INSERT INTO pedidos (cliente_id, prato_id, quantidade, status) VALUES (?, ?, ?, ?)')
  const info = stmt.run(cliente_id, prato_id, quantidade, status)
  
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(pedido)
})

app.get('/api/pedidos', (req: express.Request, res: express.Response) => {
  const status = req.query.status
  if (typeof status === 'string' && status.length > 0) {
    const stmt = db.prepare('SELECT * FROM pedidos WHERE status = ?')
    res.json(stmt.all(status))
  } else {
    const stmt = db.prepare('SELECT * FROM pedidos')
    res.json(stmt.all())
  }
})

app.put('/api/pedidos/:id', (req: express.Request, res: express.Response) => {
  if (!idNumerico(req.params.id)) return res.status(400).json({ erro: 'id inválido' })
  const id = Number(req.params.id)
  
  const { cliente_id, prato_id, status } = req.body
  const quantidade = Number(req.body.quantidade)
  
  if (!idNumerico(cliente_id) || !idNumerico(prato_id)) {
    return res.status(400).json({ erro: 'cliente_id e prato_id devem ser numéricos' })
  }
  
  if (!Number.isInteger(quantidade) || quantidade <= 0 || !status) {
    return res.status(400).json({ erro: 'dados inválidos' })
  }
  
  if (!['pendente', 'preparando', 'entregue'].includes(status)) {
    return res.status(400).json({ erro: 'status inválido' })
  }
  
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id)
  if (!cliente) return res.status(400).json({ erro: 'cliente não encontrado' })
  
  const prato = db.prepare('SELECT id FROM pratos WHERE id = ?').get(prato_id)
  if (!prato) return res.status(400).json({ erro: 'prato não encontrado' })
  
  const stmt = db.prepare('UPDATE pedidos SET cliente_id = ?, prato_id = ?, quantidade = ?, status = ? WHERE id = ?')
  const info = stmt.run(cliente_id, prato_id, quantidade, status, id)
  
  if (info.changes === 0) return res.status(404).json({ erro: 'pedido não encontrado' })
  
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id)
  res.json(pedido)
})

app.patch('/api/pedidos/:id', (req: express.Request, res: express.Response) => {
  if (!idNumerico(req.params.id)) return res.status(400).json({ erro: 'id inválido' })
  const id = Number(req.params.id)
  
  const campos: string[] = []
  const valores: any[] = []
  
  if (req.body.cliente_id !== undefined) {
    if (!idNumerico(req.body.cliente_id)) return res.status(400).json({ erro: 'cliente_id deve ser numérico' })
    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.body.cliente_id)
    if (!cliente) return res.status(400).json({ erro: 'cliente não encontrado' })
    campos.push('cliente_id = ?')
    valores.push(req.body.cliente_id)
  }
  
  if (req.body.prato_id !== undefined) {
    if (!idNumerico(req.body.prato_id)) return res.status(400).json({ erro: 'prato_id deve ser numérico' })
    const prato = db.prepare('SELECT id FROM pratos WHERE id = ?').get(req.body.prato_id)
    if (!prato) return res.status(400).json({ erro: 'prato não encontrado' })
    campos.push('prato_id = ?')
    valores.push(req.body.prato_id)
  }
  
  if (req.body.quantidade !== undefined) {
    const quantidade = Number(req.body.quantidade)
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({ erro: 'quantidade inválida' })
    }
    campos.push('quantidade = ?')
    valores.push(quantidade)
  }
  
  if (req.body.status !== undefined) {
    if (!['pendente', 'preparando', 'entregue'].includes(req.body.status)) {
      return res.status(400).json({ erro: 'status inválido' })
    }
    campos.push('status = ?')
    valores.push(req.body.status)
  }
  
  if (campos.length === 0) return res.status(400).json({ erro: 'nenhum campo enviado' })
  
  valores.push(id)
  
  const atualizar = db.transaction(() => {
    const info = db.prepare(`UPDATE pedidos SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    if (info.changes === 0) return null
    return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id)
  })
  
  const pedido = atualizar()
  if (!pedido) return res.status(404).json({ erro: 'pedido não encontrado' })
  
  res.json(pedido)
})

app.delete('/api/pedidos/:id', (req: express.Request, res: express.Response) => {
  if (!idNumerico(req.params.id)) return res.status(400).json({ erro: 'id inválido' })
  const id = Number(req.params.id)
  
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id)
  if (!pedido) return res.status(404).json({ erro: 'pedido não encontrado' })

  db.prepare('DELETE FROM pedidos WHERE id = ?').run(id)
  
  res.json(pedido)
})
app.listen(3000, () => {
  console.log('API rodando em http://localhost:3000')
})

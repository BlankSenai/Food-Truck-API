import express from 'express'
import { inicializarBanco } from './database.js'

// Cria as tabelas antes de subir o servidor
inicializarBanco()

const app = express()
app.use(express.json())

// ===== CATEGORIAS E PRATOS =====

// ===== CLIENTES E PEDIDOS =====

app.listen(3000, () => {
  console.log('API rodando em http://localhost:3000')
})

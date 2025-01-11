import dotenv from 'dotenv'
import express from 'express'
import path from 'path'

const pathname = path.resolve()

dotenv.config({
  path: path.resolve(pathname, '.env.local'),
  override: true,
})

import { app, server } from './socket'

const PORT = process.env.PORT || 5000

// Middlewares
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

server.listen(PORT, () => console.log(`Server started at port ${PORT}`))

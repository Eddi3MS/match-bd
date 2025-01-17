import dotenv from 'dotenv'
import path from 'path'

const pathname = path.resolve()

dotenv.config({
  path: path.resolve(pathname, '.env.local'),
  override: true,
})

import { server } from './socket'

const PORT = process.env.PORT || 5000

server.listen(PORT, () => console.log(`Server started at port ${PORT}`))

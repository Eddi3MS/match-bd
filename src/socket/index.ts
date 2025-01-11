import { Server, Socket as DefaultSocket } from 'socket.io'
import http from 'http'
import express from 'express'
import cors from 'cors'
import * as cookie from 'cookie'
import { jwtVerify } from 'jose'

interface UserPayload {
  id: string
}

interface CustomSocket extends DefaultSocket {
  user?: UserPayload
}

const app = express()
const key = new TextEncoder().encode(process.env.AUTH_SECRET)

// Function to verify the token
export async function verifyToken(input: string) {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    })
    return payload as {
      user: {
        id: string
      }
      expires: Date
    }
  } catch (err: any) {
    console.error('JWT verification failed:', err.message)
    throw new Error('Invalid or expired token')
  }
}

app.use(
  cors({
    credentials: true,
    origin: process.env.ALLOWED_ORIGIN as string,
  })
)

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    credentials: true,
    origin: process.env.ALLOWED_ORIGIN as string,
    methods: ['GET', 'POST'],
  },
})

const users = new Map()

io.use(async (socket: CustomSocket, next) => {
  try {
    const cookies = socket.handshake.headers.cookie
    if (!cookies) throw new Error('Missing credentials')

    const sessionCookie = cookie.parse(cookies)?.['session']
    if (!sessionCookie) throw new Error('Session cookie not found')

    const session = await verifyToken(sessionCookie)

    // Attach the user information to the socket object for later use
    socket.user = session.user

    next() // Allow the connection
  } catch (err: any) {
    console.error('Authentication error:', err.message)
    next(new Error('Authentication failed')) // Reject the connection
  }
})

// When a user connects to the server
io.on('connection', async (socket: CustomSocket) => {
  users.set(socket.user!.id, socket.id)

  socket.emit('online', socket.user!.id)

  socket.on('send_message', ({ recipientId, conversation }) => {
    const recipientSocketId = users.get(recipientId)

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive_message', conversation)
    }
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)

    for (const [userId, socketId] of users.entries()) {
      if (socketId === socket.id) {
        users.delete(userId)
        socket.emit('offline', userId)

        console.log(`${userId} removed from users map`)
        break
      }
    }
  })
})

export { io, server, app }

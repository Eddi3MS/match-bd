import cors from 'cors'
import express from 'express'
import http from 'http'
import { jwtVerify } from 'jose'
import { Socket as DefaultSocket, Server } from 'socket.io'

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

// Middlewares
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    credentials: true,
    origin: process.env.ALLOWED_ORIGIN as string,
    methods: ['GET', 'POST', 'OPTIONS'],
  },
  transports: ['websocket', 'polling'],
})

const users = new Map()

io.use(async (socket: CustomSocket, next) => {
  try {
    const token = socket.handshake.headers.authorization
    if (!token) throw new Error('Missing credentials')

    const session = await verifyToken(token)

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
  const userId = socket.user!.id
  if (!users.has(userId)) {
    users.set(userId, []);
  }
  
  users.get(userId).push(socket.id);

  io.emit('online', Array.from(users.keys()))

  console.log('🚀 ~ io ~ conectados: userIds ->', Array.from(users.keys()))

  socket.on('send_message', ({ recipientId, conversation }) => {
    const recipientSocketIds = users.get(recipientId) || []

    recipientSocketIds.forEach((socketId:string) => {
      if (socketId) {
        io.to(socketId).emit('receive_message', conversation)
      }
    });

  })

  socket.on('disconnect', () => {
    const sockets = users.get(userId) || [];
    const updatedSockets = sockets.filter((id:string) => id !== socket.id);
    if (updatedSockets.length > 0) {
      users.set(userId, updatedSockets);
    } else {
      users.delete(userId);
    }

    io.emit('online', Array.from(users.keys()))

    console.log('User disconnected: socketId ->', socket.id)
  })
})

export { app, io, server }

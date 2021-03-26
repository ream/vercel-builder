import { createServer } from 'http'
const { createHandler } = require('./ream__handler.js')
const {
  Bridge,
}: typeof import('@vercel/node-bridge') = require('./vercel__bridge.js')

const handlerPromise = createHandler('.')

const server = createServer(async (req: any, res: any) => {
  const handler = await handlerPromise
  return handler(req, res)
})

const bridge = new Bridge(server)

bridge.listen()

export const launcher = bridge.launcher

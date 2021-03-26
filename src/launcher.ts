const { createHandler } = require('./ream__handler.js')
const { Bridge } = require('./vercel__bridge.js')

const handlerPromise = createHandler('.')

const bridge = new Bridge(async (req: any, res: any) => {
  const handler = await handlerPromise
  return handler(req, res)
})

bridge.listen()

export const launcher = bridge.launcher

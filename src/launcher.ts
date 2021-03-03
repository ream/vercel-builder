const { handler } = require('./ream__handler.js')
const { Bridge } = require('./vercel__bridge.js')

const bridge = new Bridge(handler)

bridge.listen()

export const launcher = bridge.launcher

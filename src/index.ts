import path from 'path'
import fs from 'fs'
import execa from 'execa'
import {
  BuildOptions,
  createLambda,
  FileBlob,
  glob,
  runNpmInstall,
} from '@vercel/build-utils'

export async function build(options: BuildOptions) {
  const dir = path.dirname(options.entrypoint)

  await runNpmInstall(dir, [
    '--prefer-offline',
    '--frozen-lockfile',
    '--non-interactive',
    '--production=false',
  ])

  // Build the code here…
  await execa('./node_modules/.bin/ream', ['build', '--standalone'], {
    stdio: 'inherit',
    cwd: dir,
  })

  const lambda = createLambda({
    runtime: 'nodejs14.x',
    handler: 'index.handler',
    files: {
      'index.js': new FileBlob({
        data: await fs.promises.readFile(
          '.ream/meta/server-context-bundle.js',
          'utf8',
        ),
      }),
    },
  })

  const staticFiles = await glob('**', path.join(dir, '.ream/client'))

  return {
    output: {
      ...lambda,
      ...staticFiles,
    },
    watch: [
      // Dependent files to trigger a rebuild in `vercel dev` go here…
    ],
    routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/index' }],
  }
}

import path from 'path'
import fs from 'fs'
import execa from 'execa'
import {
  BuildOptions,
  createLambda,
  download,
  FileBlob,
  glob,
  runNpmInstall,
  getSpawnOptions,
  getNodeVersion,
  Files,
  FileFsRef,
} from '@vercel/build-utils'

export async function build({
  files,
  entrypoint,
  workPath,
  repoRootPath,
  config = {},
  meta = {},
}: BuildOptions) {
  const dir = path.dirname(entrypoint)
  const entrypointPath = path.join(workPath, dir)

  // Get folder where we'll store node_modules
  const modulesPath = path.join(entrypointPath, 'node_modules')

  // Create a real filesystem
  console.log('Downloading files...')
  await download(files, workPath, meta)

  // Change current working directory to cwd
  process.chdir(entrypointPath)
  console.log('Working directory:', process.cwd())

  // Read package.json
  try {
    require(path.join(entrypointPath, 'package.json'))
  } catch (e) {
    throw new Error(`Can not read package.json from ${entrypointPath}`)
  }

  const nodeVersion = await getNodeVersion(entrypointPath, undefined, {}, meta)
  const spawnOptions = {
    entrypointPath,
    ...getSpawnOptions(meta, nodeVersion),
  }

  await runNpmInstall(
    entrypointPath,
    [
      '--prefer-offline',
      '--frozen-lockfile',
      '--non-interactive',
      `--modules-folder=${modulesPath}`,
    ],
    { ...spawnOptions },
    meta,
  )

  // Build the code here…
  await execa('npx', ['ream', 'build', '--standalone'], {
    ...spawnOptions,
    env: { ...spawnOptions.env },
    stdio: 'inherit',
  })

  const launcherPath = path.join(__dirname, 'launcher.js')
  const launcherSrc = await fs.promises.readFile(launcherPath, 'utf8')
  const reamHandlerPath = path.join(
    entrypointPath,
    '.ream/server/standalone-bundle.js',
  )
  const reamHandlerSrc = await fs.promises.readFile(reamHandlerPath, 'utf8')

  const exportedFiles = await glob(
    '**',
    path.join(entrypointPath, '.ream/export'),
    '.ream/export',
  )
  const launcherFiles: Files = {
    ...exportedFiles,
    'ream__handler.js': new FileBlob({ data: reamHandlerSrc }),
    'vercel__launcher.js': new FileBlob({ data: launcherSrc }),
    'vercel__bridge.js': new FileFsRef({
      fsPath: require('@vercel/node-bridge'),
    }),
  }

  const lambda = await createLambda({
    runtime: nodeVersion.runtime,
    handler: 'vercel__launcher.launcher',
    files: launcherFiles,
    environment: {
      NODE_ENV: 'production',
    },
    maxDuration:
      typeof config.maxDuration === 'number' ? config.maxDuration : undefined,
    memory: typeof config.memory === 'number' ? config.memory : undefined,
  })

  const staticFiles = await glob(
    '**',
    path.join(entrypointPath, '.ream/client'),
  )

  return {
    output: {
      index: lambda,
      ...staticFiles,
    },
    watch: [
      // Dependent files to trigger a rebuild in `vercel dev` go here…
    ],
    routes: [
      // TODO: set cache header for static files
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index' },
    ],
  }
}

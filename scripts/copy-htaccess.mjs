import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const source = resolve('public', '.htaccess')
const destination = resolve('dist', '.htaccess')

if (!existsSync(source)) {
  console.warn('[copy-htaccess] Source not found:', source)
  process.exit(0)
}

mkdirSync(dirname(destination), { recursive: true })
cpSync(source, destination)
console.log('[copy-htaccess] Copied .htaccess to dist/.htaccess')

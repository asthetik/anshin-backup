// 生成可在浏览器里打开的真实界面预览：
// 把 out/renderer 的真实构建产物拷到 design/preview-app，
// 注入一个 mock 的 window.anshin（scripts/preview-stub.js），然后起静态服务。
//
//   pnpm build && pnpm preview
//   → http://127.0.0.1:8768/
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const BUILT = join(ROOT, 'out', 'renderer')
const PREVIEW = join(ROOT, 'design', 'preview-app')
const STUB = join(ROOT, 'scripts', 'preview-stub.js')
const PORT = Number(process.env.PORT ?? 8768)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

if (!existsSync(join(BUILT, 'index.html'))) {
  console.error('找不到 out/renderer，先跑 pnpm build')
  process.exit(1)
}

if (!existsSync(STUB)) {
  console.error('找不到 scripts/preview-stub.js')
  process.exit(1)
}

// 清掉旧产物，避免 cp -R 把新文件嵌进旧目录
rmSync(join(PREVIEW, 'assets'), { recursive: true, force: true })
rmSync(join(PREVIEW, 'fonts'), { recursive: true, force: true })
mkdirSync(PREVIEW, { recursive: true })

cpSync(join(BUILT, 'assets'), join(PREVIEW, 'assets'), { recursive: true })
if (existsSync(join(BUILT, 'fonts'))) {
  cpSync(join(BUILT, 'fonts'), join(PREVIEW, 'fonts'), { recursive: true })
}
// 页面里的 ./stub.js 由这里生成；源文件在 scripts/，不占 design 的版本
cpSync(STUB, join(PREVIEW, 'stub.js'))

// stub 必须在模块脚本之前执行：普通 script 解析时立即执行，module 是延迟的
let html = readFileSync(join(BUILT, 'index.html'), 'utf8')
if (!html.includes('./stub.js')) {
  html = html.replace(
    '    <script type="module"',
    '    <script src="./stub.js"></script>\n    <script type="module"',
  )
  writeFileSync(join(PREVIEW, 'index.html'), html)
} else {
  writeFileSync(join(PREVIEW, 'index.html'), html)
}

/** 端口被上一个预览进程占着时，只回收那个进程，别动别人的服务 */
function releasePort(port) {
  let pids = ''
  try {
    pids = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' })
  } catch {
    return
  }
  for (const pid of pids
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)) {
    let command = ''
    try {
      command = execFileSync('ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8' })
    } catch {
      continue
    }
    if (!command.includes('scripts/preview.mjs')) continue
    try {
      process.kill(Number(pid), 'SIGTERM')
      console.log(`已停止旧的预览进程 ${pid}`)
    } catch {
      // 进程已经不在了
    }
  }
}

releasePort(PORT)

const server = createServer((req, res) => {
  // 畸形 URL 不能让整个服务挂掉
  let pathname = '/'
  try {
    pathname = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`).pathname
  } catch {
    res.writeHead(400).end('bad request')
    return
  }
  const rel = pathname === '/' ? '/index.html' : pathname
  const file = join(PREVIEW, decodeURIComponent(rel))
  if (!file.startsWith(PREVIEW)) {
    res.writeHead(403).end()
    return
  }
  try {
    const body = readFileSync(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`预览已启动 → http://127.0.0.1:${PORT}/`)
})

server.on('error', (error) => {
  console.error(`预览服务启动失败：${error.message}`)
  process.exit(1)
})

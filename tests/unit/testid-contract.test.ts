/**
 * L2 契约测试 · e2e 选择器约定的兑现校验
 *
 * 为什么需要（2026-07-29，E2E-1 的教训）：
 * `tests/e2e/README` 把 8 个 data-testid 写成「已约定」，但实现里长期只落地了 2 个。
 * S1 那 20 条 e2e 失败的根因就是这个——整批用例依赖一套写在文档里却从未实现的契约。
 * 而且其中 `chat-message-assistant` 在实现里叫 `assistant-msg`，**纯命名不一致**，
 * 这类脱节不跑 e2e 永远发现不了，而 e2e 又长期没在 CI 跑。
 *
 * 本测试把「文档写了」变成「CI 校验」：README 列出的固定 testid 必须在代码中存在。
 * 它跑在单测层（毫秒级、无需浏览器与数据库），因此每次提交都会执行——
 * 不像 e2e 那样需要 secrets 和门禁配置才生效。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

// README 中带 <占位符> 的是动态 ID（stat-<页签名> / block-<节点类型> /
// node-status-<节点类型>），由代码模板拼接，无法按字面 grep，故不在校验范围内。
const CONTRACT_IDS = [
  'user-menu',
  'metric-calls',
  'chat-message-assistant',
  'citation',
  'retrieval-score',
  'skill-installs',
  'canvas',
  'run-result',
] as const

/** 递归收集源码文件（只看会渲染 DOM 的目录） */
function collectSources(dirs: string[]): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        walk(p)
      } else if (/\.(tsx|ts)$/.test(entry.name)) {
        out.push(p)
      }
    }
  }
  dirs.forEach((d) => walk(path.join(ROOT, d)))
  return out
}

const SOURCES = collectSources(['components', 'app'])
const HAYSTACK = SOURCES.map((f) => fs.readFileSync(f, 'utf8')).join('\n')

describe('e2e 选择器契约（tests/e2e/README 的约定必须兑现）', () => {
  it('源码目录可读且非空（守住 collectSources 本身失效的情况）', () => {
    expect(SOURCES.length).toBeGreaterThan(50)
  })

  for (const id of CONTRACT_IDS) {
    it(`data-testid="${id}" 在代码中存在`, () => {
      const present = HAYSTACK.includes(`data-testid="${id}"`)
      expect(
        present,
        present ? '' :
          `README 约定了 data-testid="${id}"，但代码中找不到。\n` +
          `要么在对应 UI 加上它，要么从 tests/e2e/README 的约定清单里移除——` +
          `不要让文档与实现各说各的（S1 的 20 条 e2e 失败就是这么来的）。`,
      ).toBe(true)
    })
  }

  it('README 的约定清单与本测试的 CONTRACT_IDS 同步', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'tests/e2e/README.md'), 'utf8')
    const missing = CONTRACT_IDS.filter((id) => !readme.includes(`\`${id}\``))
    expect(
      missing,
      missing.length
        ? `以下 ID 在本测试里校验，却已不在 README 约定清单中：${missing.join(', ')}。\n` +
          `两处需保持同步，否则校验的是过时契约。`
        : '',
    ).toEqual([])
  })
})

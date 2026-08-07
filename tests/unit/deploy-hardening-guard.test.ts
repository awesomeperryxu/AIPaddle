/**
 * 部署链路加固的防回归守卫（OPS-3）。
 *
 * 这些断言不是形式主义——同一类「半更新态」故障已复发三次：
 *   2026-08-03  手工部署：git reset 先跑、构建后失败 → 新源码 + 旧 .next，多路由 500
 *   2026-08-05  部署 OOM：构建被 SIGKILL，靠「pm2 恰好没重启」侥幸没炸
 *   2026-08-07  工作流被取消：源码停在 9c1c6d1、.next 停在 15:48，
 *               用户刷新页面一个半小时看到的都是旧产物；
 *               同时服务器上跑着 3 个孤儿 next build，把 7.6G 内存吃穿触发 OOM killer
 *
 * 每次都是同一个根因家族：**源码切换与构建产物切换不是原子的**，
 * 任何一条中断路径没兜住，线上就停在两者不一致的状态。
 * 这些加固很容易在后续重构中被"清理"掉，故用测试钉死。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const workflow = readFileSync(resolve(root, '.github/workflows/deploy.yml'), 'utf8')
const deployScript = readFileSync(resolve(root, 'scripts/deploy.sh'), 'utf8')

describe('部署工作流：中断路径必须兜住', () => {
  // 🔴 只 trap EXIT 兜不住取消：runner 杀 ssh 客户端后，远端 bash 收到的是
  // HUP/PIPE 而非正常退出，而 bash 对未捕获的致命信号不执行 EXIT trap。
  // 2026-08-07 的半更新态就是这么留下的。
  it('回滚 trap 捕获致命信号，而不只是 EXIT', () => {
    const m = workflow.match(/trap\s+cleanup\s+([A-Z ]+)/)
    expect(m, '未找到 trap cleanup').toBeTruthy()
    const signals = m![1].trim().split(/\s+/)
    for (const sig of ['EXIT', 'INT', 'TERM', 'HUP', 'PIPE']) {
      expect(signals, `trap 必须捕获 ${sig}`).toContain(sig)
    }
  })

  it('失败时把源码回退到部署前版本', () => {
    expect(workflow).toMatch(/git reset --hard "\$PREV_SHA"/)
  })

  // 两条路径产物落地方式不同（CI 解包 / 应急就地构建），但都必须先落 .next.new
  // 再原子切换——绝不在成功前动线上 .next。
  it('CI 路径：产物解包到 .next.new 后才切换', () => {
    expect(workflow).toMatch(/tar xzf .*-C \.next\.new/)
    expect(workflow).toMatch(/mv \.next\.new \.next/)
  })

  it('应急路径：构建到 .next.new 后才切换', () => {
    expect(deployScript).toContain('NEXT_DIST_DIR=.next.new')
    expect(deployScript).toMatch(/mv \.next\.new \.next/)
  })
})

describe('部署互斥：两条部署路径必须共用同一把锁', () => {
  // 🔴 工作流与 scripts/deploy.sh 是两条独立路径。此前只有后者持锁，
  // 结果 2026-08-07 两个 next build 并发跑，各吃 ~2.5G 直接把机器压垮。
  // 锁文件路径必须逐字一致，否则是两把锁，等于没锁。
  const LOCK = '/tmp/aipaddle-deploy.lock'

  it('工作流持锁', () => {
    expect(workflow).toContain(LOCK)
    expect(workflow).toMatch(/flock/)
  })

  it('deploy.sh 持锁', () => {
    expect(deployScript).toContain(LOCK)
    expect(deployScript).toMatch(/flock/)
  })

  it('未获锁时直接跳过，且不触发源码回滚', () => {
    // 拿不到锁说明另一次部署在跑，它只会部署更新或相同的代码；
    // 此刻尚未改动任何文件，回滚反而会误伤。
    const lockBlock = workflow.slice(workflow.indexOf('flock -w'), workflow.indexOf('flock -w') + 260)
    expect(lockBlock).toMatch(/exit 0/)
    // 加锁必须发生在设置 trap 之前，否则跳过时会误触发回滚
    expect(workflow.indexOf('flock -w')).toBeLessThan(workflow.indexOf('trap cleanup'))
  })
})

describe('构建位置与内存', () => {
  // OPS-2：CI 构建搬去 runner，生产机只解包。实测 next build 在这台 4 核 7.6G
  // （还跑着 Dify 全家桶）上吃 289% CPU + 1.86GB，被 OOM killer 杀是必然而非偶发。
  it('生产机侧的部署脚本不再执行 next build', () => {
    const remote = workflow.slice(workflow.indexOf("<<'REMOTE'"))
    expect(remote).not.toMatch(/pnpm build|next build --/)
    expect(remote).toMatch(/tar xzf .*next-build\.tar\.gz/)
  })

  it('runner 上的构建 job 存在且产物排除 cache', () => {
    expect(workflow).toMatch(/runs-on: ubuntu-latest[\s\S]*?run: pnpm build/)
    // 含 cache 的 .next 是 831MB，排除后 16MB
    expect(workflow).toMatch(/--exclude='\.\/cache'/)
  })

  // 🔴 deploy.sh --force-manual 应急路径仍在生产机构建，那里仍需限堆：
  // 不设上限时 V8 按物理内存自估，会一路涨到被内核 OOM killer 杀掉（exit 137），
  // 那是不可诊断的失败且会牵连同机其他服务。
  it('应急手工部署的构建带 --max-old-space-size', () => {
    expect(deployScript).toMatch(/NODE_OPTIONS="--max-old-space-size=\d+"/)
  })
})

describe('孤儿构建进程清理', () => {
  // 🔴 CI 已不在生产机构建（OPS-2），但 deploy.sh --force-manual 应急路径仍会。
  // 它被中断时 ssh 只杀客户端、杀不掉远端进程，留下孤儿继续吃内存——
  // 2026-08-07 现场抓到 3 个，是 OOM 的直接推手。
  it('持锁后清理长时间运行的 next build', () => {
    expect(workflow).toMatch(/pgrep -f "next build"/)
    expect(workflow).toMatch(/etimes/)
    // 清理必须在拿到锁之后——锁内仍存在的 build 才能确定是孤儿
    expect(workflow.indexOf('flock -w')).toBeLessThan(workflow.indexOf('pgrep -f "next build"'))
  })
})

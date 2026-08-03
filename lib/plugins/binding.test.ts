import { describe, it, expect } from 'vitest'
import {
  assertApiBinding, assertDbBinding, deriveToolsFromOpenApi, BindingConfigError,
} from './binding'

const okApi = {
  endpoint: 'https://api.example.com/v1/users',
  method: 'GET',
  allowed_hosts: ['api.example.com'],
}

describe('assertApiBinding', () => {
  it('接受合法配置并补上默认值', () => {
    const c = assertApiBinding(okApi)
    expect(c.endpoint).toBe('https://api.example.com/v1/users')
    expect(c.method).toBe('GET')
    expect(c.timeout_ms).toBe(10_000)
    expect(c.retry).toBe(1)
    expect(c.response_filter).toEqual([])
  })

  it('键名输出 snake_case，与 tool_versions.binding_config 表注释一致', () => {
    // 这块是 jsonb 直存直取，校验器输出什么形状库里就是什么形状
    const c = assertApiBinding({ ...okApi, operation_id: 'listUsers' })
    expect(Object.keys(c).sort()).toEqual(
      ['allowed_hosts', 'endpoint', 'method', 'operation_id', 'response_filter', 'retry', 'timeout_ms'],
    )
  })

  // ── 安全边界 ──
  it('拒绝 http（凭证明文传输）', () => {
    expect(() => assertApiBinding({ ...okApi, endpoint: 'http://api.example.com/v1' }))
      .toThrow(/https/)
  })

  it('域名白名单为空时拒绝，而不是放行一切', () => {
    // 用「必须配置」而非泛泛的 /白名单/ —— 后者会被「不在白名单内」那条守卫
    // 顺带满足，于是拆掉这条守卫测试依然绿（破坏性验证时踩到过）
    expect(() => assertApiBinding({ ...okApi, allowed_hosts: [] })).toThrow(/必须配置域名白名单/)
    expect(() => assertApiBinding({ ...okApi, allowed_hosts: undefined })).toThrow(/必须配置域名白名单/)
  })

  it('拒绝通配符白名单', () => {
    expect(() => assertApiBinding({ ...okApi, allowed_hosts: ['*'] })).toThrow(/通配符/)
    expect(() => assertApiBinding({ ...okApi, allowed_hosts: ['*.example.com'] })).toThrow(/通配符/)
  })

  it('endpoint 的域名不在白名单内时拒绝（否则白名单形同虚设）', () => {
    expect(() => assertApiBinding({
      ...okApi,
      endpoint: 'https://evil.com/steal',
      allowed_hosts: ['api.example.com'],
    })).toThrow(/不在白名单内/)
  })

  it('拦住指向内网的 SSRF 目标（不在白名单即拒）', () => {
    for (const host of ['169.254.169.254', 'localhost', '10.0.0.1']) {
      expect(() => assertApiBinding({ ...okApi, endpoint: `https://${host}/` }))
        .toThrow(BindingConfigError)
    }
  })

  it('超时与重试超出范围时拒绝', () => {
    expect(() => assertApiBinding({ ...okApi, timeout_ms: 999 })).toThrow(/超时/)
    expect(() => assertApiBinding({ ...okApi, timeout_ms: 999_999 })).toThrow(/超时/)
    expect(() => assertApiBinding({ ...okApi, retry: 99 })).toThrow(/重试/)
    expect(() => assertApiBinding({ ...okApi, retry: -1 })).toThrow(/重试/)
  })

  it('拒绝非法 HTTP 方法', () => {
    expect(() => assertApiBinding({ ...okApi, method: 'TRACE' })).toThrow(/方法/)
  })
})

describe('assertDbBinding', () => {
  const okDb = {
    query_template: 'select id, name from customers where org_id = :org',
    allowed_tables: ['customers'],
  }

  it('接受只读查询并补默认值', () => {
    const c = assertDbBinding(okDb)
    expect(c.max_rows).toBe(100)
    expect(c.select_only).toBe(true)
    expect(c.allowed_tables).toEqual(['customers'])
  })

  it('接受 CTE 开头的只读查询', () => {
    expect(() => assertDbBinding({
      ...okDb, query_template: 'with recent as (select * from orders) select * from recent',
    })).not.toThrow()
  })

  // ── select-only 的四道检查 ──
  it('拒绝非 select/with 开头', () => {
    for (const q of ['update customers set name = 1', 'delete from customers', 'drop table customers']) {
      expect(() => assertDbBinding({ ...okDb, query_template: q })).toThrow(BindingConfigError)
    }
  })

  it('拒绝分号拼接的第二条语句', () => {
    expect(() => assertDbBinding({
      ...okDb, query_template: 'select 1; drop table customers',
    })).toThrow(/多条语句|drop/)
  })

  it('允许结尾的单个分号', () => {
    expect(() => assertDbBinding({ ...okDb, query_template: 'select id from customers;' })).not.toThrow()
  })

  it('拒绝藏在 CTE 里的写操作', () => {
    expect(() => assertDbBinding({
      ...okDb, query_template: 'with x as (delete from customers returning *) select * from x',
    })).toThrow(/delete/)
  })

  it('🔴 字符串字面量里的 -- 不得被当成注释（曾被此构造绕过）', () => {
    // 回归测试。旧实现用正则剥注释，把单引号内的 -- 当注释，
    // 连带吃掉了本行剩下的 `; drop table customers`，于是分号检查与
    // 关键字检查都扫了个空 —— 而存进库的是含 drop 的原文
    expect(() => assertDbBinding({
      ...okDb, query_template: "select '--' as a from t; drop table customers",
    })).toThrow(BindingConfigError)
    expect(() => assertDbBinding({
      ...okDb, query_template: "select '/*' as a from t; drop table customers",
    })).toThrow(BindingConfigError)
  })

  it('分号检查独立生效：多条 select 也要拒（无违禁词兜底）', () => {
    // 只靠关键字清单的话这条会漏 —— 两条语句都是 select
    expect(() => assertDbBinding({
      ...okDb, query_template: 'select 1; select 2',
    })).toThrow(/多条语句/)
  })

  it('注释里的内容不参与判定（不误拒合法查询）', () => {
    expect(() => assertDbBinding({
      ...okDb, query_template: '-- 这里写 delete 也没关系\nselect id from customers',
    })).not.toThrow()
    expect(() => assertDbBinding({
      ...okDb, query_template: 'select id /* drop table x */ from customers',
    })).not.toThrow()
  })

  it('字符串内容不参与判定（不误拒合法查询）', () => {
    expect(() => assertDbBinding({
      ...okDb, query_template: "select id from customers where note = 'please delete me;'",
    })).not.toThrow()
  })

  it('未闭合的引号/注释一律拒绝（fail closed）', () => {
    expect(() => assertDbBinding({ ...okDb, query_template: "select 'abc from t" }))
      .toThrow(/未闭合/)
    expect(() => assertDbBinding({ ...okDb, query_template: 'select 1 /* abc from t' }))
      .toThrow(/未闭合/)
  })

  it('嵌套块注释按 Postgres 规则处理', () => {
    expect(() => assertDbBinding({
      ...okDb, query_template: 'select id /* a /* b */ c */ from customers',
    })).not.toThrow()
  })

  it('美元引用内容抹白', () => {
    expect(() => assertDbBinding({
      ...okDb, query_template: 'select $tag$ drop table x; $tag$ as note from customers',
    })).not.toThrow()
  })

  it('存入库的是原文（含注释），不是抹白后的结果', () => {
    const q = '-- 取用户\nselect id from customers'
    expect(assertDbBinding({ ...okDb, query_template: q }).query_template).toBe(q)
  })

  it('不把含关键字子串的合法标识符误判', () => {
    // selected_at / updated_at 里含 select / update，靠 \b 词边界区分
    expect(() => assertDbBinding({
      ...okDb, query_template: 'select selected_at, updated_at from customers',
    })).not.toThrow()
  })

  it('select_only 恒为 true，不接受外部传入 false', () => {
    // 留成可配开关，迟早有人为了「临时跑个 update」把它关掉然后忘了打开
    const c = assertDbBinding({ ...okDb, select_only: false })
    expect(c.select_only).toBe(true)
  })

  it('库表白名单为空时拒绝', () => {
    expect(() => assertDbBinding({ ...okDb, allowed_tables: [] })).toThrow(/白名单/)
  })

  it('行数上限超出范围时拒绝', () => {
    expect(() => assertDbBinding({ ...okDb, max_rows: 0 })).toThrow(/行数/)
    expect(() => assertDbBinding({ ...okDb, max_rows: 99_999 })).toThrow(/行数/)
  })

  it('键名输出 snake_case，与表注释一致', () => {
    const c = assertDbBinding(okDb)
    expect(Object.keys(c).sort()).toEqual(
      ['allowed_tables', 'mask_fields', 'max_rows', 'param_schema', 'query_template', 'select_only'],
    )
  })
})

describe('deriveToolsFromOpenApi', () => {
  const doc = {
    servers: [{ url: 'https://api.example.com/v1' }],
    paths: {
      '/users': {
        get: { operationId: 'listUsers', summary: '查询用户列表' },
        post: { operationId: 'createUser', summary: '创建用户' },
      },
      '/users/{id}': {
        get: { operationId: 'getUser', summary: '查询单个用户', description: '按 ID 查' },
      },
    },
  }

  it('按 operation 拆成多个 Tool（AC-02）', () => {
    const tools = deriveToolsFromOpenApi(doc, ['api.example.com'])
    expect(tools).toHaveLength(3)
    expect(tools.map((t) => t.name).sort()).toEqual(['createUser', 'getUser', 'listUsers'])
  })

  it('保留 path 中的 {id} 占位符，不做 URL 转义', () => {
    const tools = deriveToolsFromOpenApi(doc, ['api.example.com'])
    const getUser = tools.find((t) => t.name === 'getUser')!
    expect(getUser.bindingConfig.endpoint).toBe('https://api.example.com/v1/users/{id}')
    expect(getUser.bindingConfig.endpoint).not.toContain('%7B')
  })

  it('把 summary / description 带过来', () => {
    const t = deriveToolsFromOpenApi(doc, ['api.example.com']).find((x) => x.name === 'getUser')!
    expect(t.displayName).toBe('查询单个用户')
    expect(t.description).toBe('按 ID 查')
  })

  it('operationId 缺失时由 method+path 生成稳定名称', () => {
    const tools = deriveToolsFromOpenApi({
      servers: [{ url: 'https://api.example.com' }],
      paths: { '/a/b': { get: {} } },
    }, ['api.example.com'])
    expect(tools[0].name).toBe('get_a_b')
  })

  it('🔴 operationId 撞名时自动去重', () => {
    // Tool 在同 Plugin 下有唯一索引，撞名会让整批导入中途 23505 失败，
    // 而前面的已经写进去了——半成品最难收拾
    const tools = deriveToolsFromOpenApi({
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/a': { get: { operationId: 'dup' } },
        '/b': { get: { operationId: 'dup' } },
      },
    }, ['api.example.com'])
    expect(new Set(tools.map((t) => t.name)).size).toBe(2)
  })

  it('导入的每个 Tool 都继承域名白名单', () => {
    const tools = deriveToolsFromOpenApi(doc, ['api.example.com'])
    for (const t of tools) expect(t.bindingConfig.allowed_hosts).toEqual(['api.example.com'])
  })

  it('白名单为空时拒绝导入', () => {
    expect(() => deriveToolsFromOpenApi(doc, [])).toThrow(/白名单/)
  })

  it('servers 缺失时报错而不是猜地址', () => {
    expect(() => deriveToolsFromOpenApi({ paths: doc.paths }, ['api.example.com']))
      .toThrow(/servers/)
  })

  // ── 真实规范里常见的 servers 写法（用实际文档结构试出来的）──
  describe('baseUrl 解析', () => {
    it('相对地址给出可操作的提示，而不是「地址无效」', () => {
      // Petstore 官方规范就写成 "url": "/v1"
      expect(() => deriveToolsFromOpenApi(
        { servers: [{ url: '/v1' }], paths: { '/pets': { get: { operationId: 'listPets' } } } },
        ['api.example.com'],
      )).toThrow(/相对地址.*请另行提供接口基地址/)
    })

    it('模板变量按 variables.default 展开（OpenAPI 规范行为）', () => {
      const tools = deriveToolsFromOpenApi({
        servers: [{
          url: 'https://{region}.api.example.com/v1',
          variables: { region: { default: 'cn' } },
        }],
        paths: { '/pets': { get: { operationId: 'listPets' } } },
      }, ['cn.api.example.com'])
      expect(tools[0].bindingConfig.endpoint).toBe('https://cn.api.example.com/v1/pets')
    })

    it('变量没有 default 时明确报错', () => {
      expect(() => deriveToolsFromOpenApi({
        servers: [{ url: 'https://{region}.api.example.com' }],
        paths: { '/pets': { get: { operationId: 'listPets' } } },
      }, ['api.example.com'])).toThrow(/未定义默认值/)
    })

    it('baseUrl 覆盖优先于文档里的 servers', () => {
      const tools = deriveToolsFromOpenApi(
        { servers: [{ url: '/v1' }], paths: { '/pets': { get: { operationId: 'listPets' } } } },
        ['api.example.com'], 'https://api.example.com/v2',
      )
      expect(tools[0].bindingConfig.endpoint).toBe('https://api.example.com/v2/pets')
    })

    it('baseUrl 覆盖同样强制 https', () => {
      expect(() => deriveToolsFromOpenApi(
        doc, ['api.example.com'], 'http://api.example.com',
      )).toThrow(/https/)
    })

    it('baseUrl 末尾多余斜杠不会拼出双斜杠', () => {
      const tools = deriveToolsFromOpenApi(
        doc, ['api.example.com'], 'https://api.example.com/v1///')
      expect(tools.every((t) => !t.bindingConfig.endpoint.includes('//users'))).toBe(true)
    })
  })

  it('paths 里的 x- 扩展键不参与解析', () => {
    const tools = deriveToolsFromOpenApi({
      servers: [{ url: 'https://api.example.com' }],
      paths: { '/a': { get: { operationId: 'getA' }, 'x-internal': true }, 'x-note': 'ignore' },
    }, ['api.example.com'])
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('getA')
  })

  it('deprecated 的 operation 照常导入但在描述里标出', () => {
    // 不静默跳过（少导一个用户会以为是 bug），也不假装正常
    const tools = deriveToolsFromOpenApi({
      servers: [{ url: 'https://api.example.com' }],
      paths: { '/a': { delete: { operationId: 'delA', deprecated: true } } },
    }, ['api.example.com'])
    expect(tools).toHaveLength(1)
    expect(tools[0].deprecated).toBe(true)
    expect(tools[0].description).toMatch(/已废弃/)
  })

  it('paths 缺失或无 operation 时报错', () => {
    expect(() => deriveToolsFromOpenApi({ servers: doc.servers }, ['api.example.com'])).toThrow(/paths/)
    expect(() => deriveToolsFromOpenApi({ servers: doc.servers, paths: {} }, ['api.example.com']))
      .toThrow(/没有可导入/)
  })

  it('🔴 文档里的 server 域名不在白名单内时拒绝', () => {
    // 否则「导入一份 OpenAPI」就等于绕过白名单
    expect(() => deriveToolsFromOpenApi({
      servers: [{ url: 'https://evil.com' }], paths: doc.paths,
    }, ['api.example.com'])).toThrow(/不在白名单内/)
  })
})

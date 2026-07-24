import 'server-only'

// ADR-012 P1：运行期变量池 + 表达式解析（纯函数，无副作用、不 import components）。
// 单值模型之上的叠加能力——未用变量的节点仍走"前驱输出拼接"旧语义。

/** 变量类型（与前端 VarType 字面量对齐，但不从 components 引入以守层依赖）。 */
export type VarType = 'string' | 'number' | 'boolean' | 'array' | 'object' | (string & {})

/**
 * 运行期变量池：
 * - vars：命名会话/本地变量（variable-assigner 写、aggregator/表达式读）
 * - outputs：各节点字符串输出（复用引擎现有 Map，键=nodeId）
 * - sysQuery：系统变量 sys.query = 本次运行输入
 */
export type VarPool = {
  vars: Record<string, unknown>
  outputs: Map<string, string>
  sysQuery: string
}

// 整体匹配 {{ ref }}（去空白后）。只支持"整串是一个引用"，不做内嵌插值（P1 范围）。
const REF_RE = /^\{\{\s*(.+?)\s*\}\}$/

/**
 * 解析表达式：
 * - `{{ sys.query }}` → pool.sysQuery
 * - `{{ ref }}` 且 ref ∈ pool.vars → 该值；ref ∈ pool.outputs → 该节点输出串；都无 → undefined
 * - 否则整体作为字面量字符串返回（原样 expr）
 */
export function resolveExpr(expr: string, pool: VarPool): unknown {
  const trimmed = (expr ?? '').trim()
  const m = REF_RE.exec(trimmed)
  if (!m) return expr
  const ref = m[1].trim()
  if (ref === 'sys.query') return pool.sysQuery
  if (Object.prototype.hasOwnProperty.call(pool.vars, ref)) return pool.vars[ref]
  if (pool.outputs.has(ref)) return pool.outputs.get(ref)
  return undefined
}

/**
 * 按目标类型尽力转换。Array/Object 尝试 JSON.parse，失败或类型不符则回退原值。
 * array[string]/array[number] 等归并为 array 处理。
 */
export function coerce(v: unknown, type: VarType): unknown {
  const t = String(type ?? '').toLowerCase()
  if (t.startsWith('array')) {
    if (Array.isArray(v)) return v
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v)
        return Array.isArray(parsed) ? parsed : v
      } catch {
        return v
      }
    }
    return v
  }
  switch (t) {
    case 'string':
      return v == null ? '' : String(v)
    case 'number': {
      const n = Number(v)
      return Number.isNaN(n) ? v : n
    }
    case 'boolean':
      if (typeof v === 'string') return v !== '' && v.toLowerCase() !== 'false' && v !== '0'
      return Boolean(v)
    case 'object':
      if (v != null && typeof v === 'object' && !Array.isArray(v)) return v
      if (typeof v === 'string') {
        try {
          const parsed = JSON.parse(v)
          return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : v
        } catch {
          return v
        }
      }
      return v
    default:
      return v
  }
}

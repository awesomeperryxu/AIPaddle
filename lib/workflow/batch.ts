// 批量运行输入解析（4.4.11）：把请求的 inputs 规整为字符串数组并按上限截断。
// 上限用于防止一次批量触发过多 LLM 调用/写入；超出部分丢弃并如实回报 truncated。
export const MAX_BATCH = 10

export function parseBatchInputs(raw: unknown, max: number = MAX_BATCH): { inputs: string[]; truncated: boolean } {
  const arr = Array.isArray(raw) ? raw : []
  const all = arr.map((x) => (typeof x === 'string' ? x : String(x ?? '')))
  return { inputs: all.slice(0, max), truncated: all.length > max }
}

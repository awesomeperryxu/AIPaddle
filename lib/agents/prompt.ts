// 4.1.15：Agent 提示词的运行期变量替换。把 systemPrompt 里的 {{变量名}} 用用户填的值替换；
// 未提供的变量保留 {{占位}}（让用户/日志看得出哪个没填）。纯函数，前后端共用。

export function substitutePromptVariables(prompt: string, values: Record<string, string>): string {
  if (!prompt) return prompt
  return prompt.replace(/\{\{\s*([\w一-龥]+)\s*\}\}/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? '') : m,
  )
}

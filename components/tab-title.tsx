'use client'

import { createContext, useContext, useEffect } from 'react'

// 详情页向顶部标签条上报自己的名字（WF-19）。
//
// 🔴 为什么需要上报而不是从路径推：/workflows/<uuid> 里除了一个 uuid 什么都没有，
// 标签上只能显示「工作流 · 详情」。用户同时开两条工作流时，两个标签长得一模一样，
// 等于没修——标签的意义就是让人一眼认出哪个是哪个。
//
// 详情页调 useTabTitle(名字)，卸载时自动撤回（传 undefined 即撤回）。
type Reporter = (view: string, title: string | undefined) => void

const TabTitleContext = createContext<Reporter | null>(null)

export function TabTitleProvider({
  report,
  children,
}: {
  report: Reporter
  children: React.ReactNode
}) {
  return <TabTitleContext.Provider value={report}>{children}</TabTitleContext.Provider>
}

/**
 * 把当前页的名字挂到它所在的标签上。
 *
 * @param view  该页对应的标签 key（= 去掉前导斜杠的 pathname）
 * @param title 显示名；空串/undefined 表示暂无（标签回落到「一级名 · 详情」）
 */
export function useTabTitle(view: string, title: string | undefined) {
  const report = useContext(TabTitleContext)
  useEffect(() => {
    if (!report) return
    report(view, title?.trim() || undefined)
    // 卸载时撤回：标签已关掉却留着旧名字，下次打开同一路径会闪一下旧标题
    return () => report(view, undefined)
  }, [report, view, title])
}

'use client';

// 下级页诚实占位（访问API / 监测 / 标注）：功能尚未接入，明确告知，不展示任何假数据。
import type { LucideIcon } from 'lucide-react';

export function WorkflowPlaceholderPage({
  icon: Icon,
  title,
  desc,
  bullets,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  bullets?: string[];
}) {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Icon className="h-9 w-9 text-muted-foreground" />
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{desc}</p>
          <span className="mt-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">即将上线（W1/W2 后续切片）</span>
        </div>
        {bullets && bullets.length > 0 && (
          <div className="mt-6 rounded-xl border border-border p-5">
            <p className="mb-2 text-xs font-medium text-muted-foreground">该页将提供（对齐 Dify）：</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-primary">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

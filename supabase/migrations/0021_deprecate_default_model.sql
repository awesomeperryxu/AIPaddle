-- 4.8.11：默认模型单一事实源。
-- 运行时按租户解析已统一走 tenants.model_settings（ADR-016 4.7.3 的 5 槽；resolveModelClient/4.8.5 消费）。
-- 旧的轻量版 tenants.default_model（4.6.3）不再被运行时消费——标废弃，不 drop（保 seed/回滚/兼容）。

comment on column public.tenants.default_model is
  'DEPRECATED（4.8.11）：默认模型单一事实源改为 model_settings（5 槽）。此列不再被运行时消费，仅历史兼容保留，勿新增依赖。';

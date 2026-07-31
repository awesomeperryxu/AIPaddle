-- V12-2.2a / V12-2.3a：Tool binding_type 与 credentials.kind 新增 'smtp'。
--
-- 【为什么需要这个迁移，而不是直接改 0029/0030】
-- commit c7ab32c9 直接改了 0029/0030 的建表语句，提交信息写「迁移尚未 apply，改文件即可」。
-- 但实际上 0028-0030 已于同日 11:0x apply 到生产库（见 MIGRATION_PLAN §1 占用登记表）。
-- 结果是**文件与生产库不一致**：文件写 5 类，库里仍是 4 类，写 'smtp' 会被 CHECK 拒绝。
--
-- 🔴 已 apply 的迁移文件**不可再改**——它是历史事实的记录。改了会导致：
--   ① 与生产库对不上（本次即如此）；
--   ② 别人拉到该文件从零重跑，得到的库结构与生产不同；
--   ③ 回滚脚本与正向脚本不再对应。
-- 正确做法永远是**新开一个迁移做增量变更**。
--
-- 本迁移把生产库补齐到与 0029/0030 当前文件内容一致。
--
-- 【SMTP 为什么单列一类】（沿用 c7ab32c9 的判断）
-- SMTP 是独立协议，与 api(HTTP) 平行；凭证形状（host/port/secure/user/pass）也不同。
-- 塞进 native 会让「平台内置 Handler」退化成杂物抽屉，后续每加一个协议都往里堆。
--
-- 迁移类型：**改既有约束**。apply 前须扫代码依赖（BUG-89 教训）——
-- 已扫：binding_type / kind 的取值目前只在迁移文件与本次新增的数据层类型中出现，
-- 无 upsert(onConflict) 等隐式依赖。放宽枚举属**扩大接受集**，不会让既有数据违约。

alter table public.tools
  drop constraint if exists tools_binding_type_check;
alter table public.tools
  add constraint tools_binding_type_check
    check (binding_type in ('mcp', 'api', 'db', 'native', 'smtp'));

comment on column public.tools.binding_type is
  'mcp | api | db | native | smtp。🔴 故意不含 workflow：Workflow 的多步/长时/可暂停语义装不进 Tool 的单次调用模型，且会让 Skill 经 Tool 间接调用 Workflow 从而绕过 D-05。';

alter table public.credentials
  drop constraint if exists credentials_kind_check;
alter table public.credentials
  add constraint credentials_kind_check
    check (kind in ('oauth', 'api_key', 'jwt', 'db_secret', 'smtp'));

comment on column public.credentials.kind is
  'oauth | api_key | jwt | db_secret | smtp。smtp：密码/授权码进 secret_ciphertext，host/port/secure/user 等非敏感连接参数进 meta。';

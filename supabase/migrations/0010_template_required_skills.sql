-- 0010: 为 YouTube 频道数据分析模板补充 requiredSkills 声明
-- 从模板创建 Agent 时会将此字段写入 agents.config，首次进入编排页触发依赖检测弹窗。

update public.templates
set dsl = dsl || jsonb_build_object(
  'requiredSkills', jsonb_build_array(
    jsonb_build_object('key', 'youtube-stats', 'name', 'YouTube 数据统计', 'description', '获取频道订阅量、播放量、视频列表等统计数据', 'icon', '📺'),
    jsonb_build_object('key', 'chart-render',  'name', '图表生成',          'description', '将数据可视化为柱状图、折线图等',                 'icon', '📊'),
    jsonb_build_object('key', 'web-search',    'name', '网络搜索',          'description', '搜索竞品频道及行业信息',                         'icon', '🔍')
  )
)
where name = 'YouTube 频道数据分析'
  and type = 'agent';

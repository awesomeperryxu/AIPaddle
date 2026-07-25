-- 0011: 为更多 Agent 模板补充 requiredSkills，使依赖安装流程覆盖全部有工具需求的模板

-- 美股投资分析助手：需要实时股价/财务数据 + 网络搜索
update public.templates
set dsl = dsl || jsonb_build_object(
  'requiredSkills', jsonb_build_array(
    jsonb_build_object('key', 'stock-data',   'name', '股票数据',   'description', '获取实时股价、PE/EPS 等财务指标',           'icon', '💹'),
    jsonb_build_object('key', 'web-search',   'name', '网络搜索',   'description', '搜索最新财报、新闻与行业分析报告',           'icon', '🔍'),
    jsonb_build_object('key', 'chart-render', 'name', '图表生成',   'description', '将财务数据可视化为走势图、对比柱状图',       'icon', '📊')
  )
)
where name = '美股投资分析助手'
  and type = 'agent'
  and is_built_in = true;

import { WorkflowPage } from '@/components/workflow';

export default function WorkflowEditorPage() {
  // 组件画廊 demo：WorkflowPage 现为 h-full 嵌入式，独立预览需给满屏高度容器。
  return (
    <div className="h-screen">
      <WorkflowPage
        title="客户支持工作流"
        appType="workflow"
        onlineUsers={[
          { id: '1', name: '张三' },
          { id: '2', name: '李四' },
        ]}
      />
    </div>
  );
}

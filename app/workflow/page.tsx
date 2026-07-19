import { WorkflowPage } from '@/components/workflow';

export default function WorkflowEditorPage() {
  return (
    <WorkflowPage
      title="客户支持工作流"
      appType="workflow"
      onlineUsers={[
        { id: '1', name: '张三' },
        { id: '2', name: '李四' },
      ]}
    />
  );
}

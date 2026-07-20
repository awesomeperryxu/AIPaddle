import { WorkflowRunPanelDemo } from "@/components/workflow/panels/workflow-run-panel";

export default function RunPanelPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Workflow Run Panel</h1>
          <p className="text-muted-foreground mt-1">
            340px 运行调试面板，包含 Result / Detail / Tracing 三个 Tab
          </p>
        </div>
        <WorkflowRunPanelDemo />
      </div>
    </div>
  );
}

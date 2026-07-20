'use client';

import { useState } from 'react';
import { WorkflowOperatorDemo, VariableInspectPanelDemo, ContextMenusDemo } from '@/components/workflow/canvas';
import { KeyboardShortcutsModalDemo } from '@/components/workflow/modals';

export default function CanvasInteractionsPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-8">Canvas Interactions</h1>
      
      <div className="space-y-12">
        {/* Workflow Operator */}
        <section>
          <h2 className="text-lg font-semibold mb-4">1. Workflow Operator (Bottom Toolbar)</h2>
          <WorkflowOperatorDemo />
        </section>

        {/* Variable Inspect Panel */}
        <section>
          <h2 className="text-lg font-semibold mb-4">2. Variable Inspect Panel</h2>
          <VariableInspectPanelDemo />
        </section>

        {/* Context Menus */}
        <section>
          <h2 className="text-lg font-semibold mb-4">3. Context Menus</h2>
          <ContextMenusDemo />
        </section>

        {/* Keyboard Shortcuts Modal */}
        <section>
          <h2 className="text-lg font-semibold mb-4">4. Keyboard Shortcuts Modal</h2>
          <KeyboardShortcutsModalDemo />
        </section>
      </div>
    </div>
  );
}

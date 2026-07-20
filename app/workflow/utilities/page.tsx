'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { VersionHistoryPanel, VersionHistoryPanelDemo } from '@/components/workflow/panels/version-history-panel';
import { EnvironmentVariablesPanelDemo } from '@/components/workflow/panels/environment-variables-panel';
import { BlockSelectorPanelDemo } from '@/components/workflow/panels/block-selector-panel';

export default function UtilitiesPage() {
  const [activeDemo, setActiveDemo] = useState<'version' | 'env' | 'block'>('version');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-muted/30 p-4">
        <h1 className="text-xl font-bold mb-4">工具面板 Demo</h1>
        <div className="flex gap-2">
          <Button
            variant={activeDemo === 'version' ? 'default' : 'outline'}
            onClick={() => setActiveDemo('version')}
          >
            版本历史
          </Button>
          <Button
            variant={activeDemo === 'env' ? 'default' : 'outline'}
            onClick={() => setActiveDemo('env')}
          >
            环境变量
          </Button>
          <Button
            variant={activeDemo === 'block' ? 'default' : 'outline'}
            onClick={() => setActiveDemo('block')}
          >
            节点选择器
          </Button>
        </div>
      </div>

      {/* Demo Content */}
      {activeDemo === 'version' && <VersionHistoryPanelDemo />}
      {activeDemo === 'env' && <EnvironmentVariablesPanelDemo />}
      {activeDemo === 'block' && <BlockSelectorPanelDemo />}
    </div>
  );
}

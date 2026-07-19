'use client';

import { useState } from 'react';
import {
  AlignLeft,
  AlignRight,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  Trash2,
  Plus,
  Clipboard,
  Maximize2,
  LayoutGrid,
  Copy,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Base menu item component
interface MenuItemProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  hasSubmenu?: boolean;
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  danger,
  disabled,
  onClick,
  hasSubmenu,
}: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-3 py-1.5 flex items-center gap-2 text-sm transition-colors',
        'hover:bg-muted',
        danger && 'text-destructive hover:bg-destructive/10',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-xs text-muted-foreground">{shortcut}</span>
      )}
      {hasSubmenu && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

function MenuSeparator() {
  return <div className="h-px bg-border my-1" />;
}

// Base context menu wrapper
interface ContextMenuWrapperProps {
  x: number;
  y: number;
  children: React.ReactNode;
  className?: string;
}

function ContextMenuWrapper({ x, y, children, className }: ContextMenuWrapperProps) {
  return (
    <div
      className={cn(
        'fixed z-50 bg-background border rounded-lg shadow-lg py-1',
        className
      )}
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  );
}

// =====================================================
// EdgeContextMenu - Edge right-click menu
// =====================================================

interface EdgeContextMenuProps {
  x: number;
  y: number;
  onEditLabel?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export function EdgeContextMenu({
  x,
  y,
  onEditLabel,
  onDelete,
  onClose,
}: EdgeContextMenuProps) {
  return (
    <ContextMenuWrapper x={x} y={y} className="w-40">
      <MenuItem
        icon={AlignLeft}
        label="编辑标签"
        onClick={() => {
          onEditLabel?.();
          onClose?.();
        }}
      />
      <MenuSeparator />
      <MenuItem
        icon={Trash2}
        label="删除连线"
        danger
        onClick={() => {
          onDelete?.();
          onClose?.();
        }}
      />
    </ContextMenuWrapper>
  );
}

// =====================================================
// PaneContextMenu - Canvas blank area right-click menu
// =====================================================

interface PaneContextMenuProps {
  x: number;
  y: number;
  onAddNode?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onAutoLayout?: () => void;
  onClose?: () => void;
  canPaste?: boolean;
}

export function PaneContextMenu({
  x,
  y,
  onAddNode,
  onPaste,
  onSelectAll,
  onAutoLayout,
  onClose,
  canPaste = true,
}: PaneContextMenuProps) {
  return (
    <ContextMenuWrapper x={x} y={y} className="w-44">
      <MenuItem
        icon={Plus}
        label="添加节点"
        onClick={() => {
          onAddNode?.();
          onClose?.();
        }}
      />
      <MenuItem
        icon={Clipboard}
        label="粘贴"
        shortcut="⌘V"
        disabled={!canPaste}
        onClick={() => {
          onPaste?.();
          onClose?.();
        }}
      />
      <MenuSeparator />
      <MenuItem
        icon={Maximize2}
        label="全选"
        shortcut="⌘A"
        onClick={() => {
          onSelectAll?.();
          onClose?.();
        }}
      />
      <MenuItem
        icon={LayoutGrid}
        label="自动整理布局"
        shortcut="⌘O"
        onClick={() => {
          onAutoLayout?.();
          onClose?.();
        }}
      />
    </ContextMenuWrapper>
  );
}

// =====================================================
// SelectionContextMenu - Multi-selection right-click menu
// =====================================================

interface SelectionContextMenuProps {
  x: number;
  y: number;
  selectedCount: number;
  onCopy?: () => void;
  onAlignLeft?: () => void;
  onAlignRight?: () => void;
  onAlignHorizontalCenter?: () => void;
  onAlignVerticalCenter?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}

export function SelectionContextMenu({
  x,
  y,
  selectedCount,
  onCopy,
  onAlignLeft,
  onAlignRight,
  onAlignHorizontalCenter,
  onAlignVerticalCenter,
  onDelete,
  onClose,
}: SelectionContextMenuProps) {
  const [showAlignSubmenu, setShowAlignSubmenu] = useState(false);

  return (
    <ContextMenuWrapper x={x} y={y} className="w-44">
      {/* Selection count */}
      <div className="px-3 py-1 text-[10px] text-muted-foreground">
        已选 {selectedCount} 个节点
      </div>
      <MenuSeparator />

      <MenuItem
        icon={Copy}
        label="复制"
        shortcut="⌘C"
        onClick={() => {
          onCopy?.();
          onClose?.();
        }}
      />
      <MenuSeparator />

      {/* Align submenu */}
      <div
        className="relative"
        onMouseEnter={() => setShowAlignSubmenu(true)}
        onMouseLeave={() => setShowAlignSubmenu(false)}
      >
        <MenuItem
          icon={AlignLeft}
          label="对齐"
          hasSubmenu
        />
        {showAlignSubmenu && (
          <div className="absolute left-full top-0 ml-1 w-40 bg-background border rounded-lg shadow-lg py-1">
            <MenuItem
              icon={AlignLeft}
              label="左对齐"
              onClick={() => {
                onAlignLeft?.();
                onClose?.();
              }}
            />
            <MenuItem
              icon={AlignRight}
              label="右对齐"
              onClick={() => {
                onAlignRight?.();
                onClose?.();
              }}
            />
            <MenuItem
              icon={AlignHorizontalJustifyCenter}
              label="水平居中"
              onClick={() => {
                onAlignHorizontalCenter?.();
                onClose?.();
              }}
            />
            <MenuItem
              icon={AlignVerticalJustifyCenter}
              label="垂直居中"
              onClick={() => {
                onAlignVerticalCenter?.();
                onClose?.();
              }}
            />
          </div>
        )}
      </div>
      <MenuSeparator />

      <MenuItem
        icon={Trash2}
        label="删除"
        shortcut="Del"
        danger
        onClick={() => {
          onDelete?.();
          onClose?.();
        }}
      />
    </ContextMenuWrapper>
  );
}

// =====================================================
// Demo component
// =====================================================

export function ContextMenusDemo() {
  return (
    <div className="p-8 space-y-8">
      <h2 className="text-lg font-semibold mb-4">Context Menus Demo</h2>
      
      <div className="flex gap-8">
        {/* Edge Menu */}
        <div className="relative">
          <h3 className="text-sm font-medium mb-2">Edge Context Menu</h3>
          <div className="relative bg-muted/30 rounded-lg border p-4 h-[150px] w-[200px]">
            <div className="absolute" style={{ left: 20, top: 40 }}>
              <div className="bg-background border rounded-lg shadow-lg py-1 w-40">
                <MenuItem icon={AlignLeft} label="编辑标签" />
                <MenuSeparator />
                <MenuItem icon={Trash2} label="删除连线" danger />
              </div>
            </div>
          </div>
        </div>

        {/* Pane Menu */}
        <div className="relative">
          <h3 className="text-sm font-medium mb-2">Pane Context Menu</h3>
          <div className="relative bg-muted/30 rounded-lg border p-4 h-[200px] w-[220px]">
            <div className="absolute" style={{ left: 20, top: 20 }}>
              <div className="bg-background border rounded-lg shadow-lg py-1 w-44">
                <MenuItem icon={Plus} label="添加节点" />
                <MenuItem icon={Clipboard} label="粘贴" shortcut="⌘V" />
                <MenuSeparator />
                <MenuItem icon={Maximize2} label="全选" shortcut="⌘A" />
                <MenuItem icon={LayoutGrid} label="自动整理布局" shortcut="⌘O" />
              </div>
            </div>
          </div>
        </div>

        {/* Selection Menu */}
        <div className="relative">
          <h3 className="text-sm font-medium mb-2">Selection Context Menu</h3>
          <div className="relative bg-muted/30 rounded-lg border p-4 h-[250px] w-[220px]">
            <div className="absolute" style={{ left: 20, top: 20 }}>
              <div className="bg-background border rounded-lg shadow-lg py-1 w-44">
                <div className="px-3 py-1 text-[10px] text-muted-foreground">
                  已选 3 个节点
                </div>
                <MenuSeparator />
                <MenuItem icon={Copy} label="复制" shortcut="⌘C" />
                <MenuSeparator />
                <MenuItem icon={AlignLeft} label="对齐" hasSubmenu />
                <MenuSeparator />
                <MenuItem icon={Trash2} label="删除" shortcut="Del" danger />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

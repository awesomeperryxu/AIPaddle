'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Link,
  List,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Theme types
type NoteTheme = 'yellow' | 'blue' | 'green' | 'purple' | 'pink' | 'orange' | 'gray' | 'white';

interface NoteNodeEditorProps {
  initialContent?: string;
  initialTheme?: NoteTheme;
  initialWidth?: number;
  initialHeight?: number;
  author?: string;
  showAuthor?: boolean;
  onContentChange?: (content: string) => void;
  onThemeChange?: (theme: NoteTheme) => void;
  onSizeChange?: (width: number, height: number) => void;
  onShowAuthorChange?: (show: boolean) => void;
  onBlur?: () => void;
}

// Theme color configuration
const THEME_COLORS: Record<NoteTheme, { bg: string; border: string; text: string; toolbar: string; swatch: string }> = {
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-900',
    toolbar: 'bg-yellow-100',
    swatch: '#FEF08A',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-900',
    toolbar: 'bg-blue-100',
    swatch: '#BFDBFE',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-900',
    toolbar: 'bg-green-100',
    swatch: '#BBF7D0',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    text: 'text-purple-900',
    toolbar: 'bg-purple-100',
    swatch: '#E9D5FF',
  },
  pink: {
    bg: 'bg-pink-50',
    border: 'border-pink-300',
    text: 'text-pink-900',
    toolbar: 'bg-pink-100',
    swatch: '#FBCFE8',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-900',
    toolbar: 'bg-orange-100',
    swatch: '#FED7AA',
  },
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-900',
    toolbar: 'bg-gray-100',
    swatch: '#E5E7EB',
  },
  white: {
    bg: 'bg-white',
    border: 'border-gray-200',
    text: 'text-gray-900',
    toolbar: 'bg-gray-50',
    swatch: '#FFFFFF',
  },
};

const THEMES: NoteTheme[] = ['yellow', 'blue', 'green', 'purple', 'pink', 'orange', 'gray', 'white'];

const MIN_WIDTH = 160;
const MIN_HEIGHT = 80;

export function NoteNodeEditor({
  initialContent = '',
  initialTheme = 'yellow',
  initialWidth = 240,
  initialHeight = 160,
  author,
  showAuthor: initialShowAuthor = true,
  onContentChange,
  onThemeChange,
  onSizeChange,
  onShowAuthorChange,
  onBlur,
}: NoteNodeEditorProps) {
  const [theme, setTheme] = useState<NoteTheme>(initialTheme);
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [showAuthor, setShowAuthor] = useState(initialShowAuthor);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  const colors = THEME_COLORS[theme];

  // Update active formats based on selection
  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('insertUnorderedList')) formats.add('list');
    setActiveFormats(formats);
  }, []);

  // Format handlers
  const handleFormat = useCallback((command: string) => {
    document.execCommand(command, false);
    contentRef.current?.focus();
    updateActiveFormats();
  }, [updateActiveFormats]);

  const handleLink = useCallback(() => {
    const url = prompt('输入链接 URL:');
    if (url) {
      document.execCommand('createLink', false, url);
    }
    contentRef.current?.focus();
  }, []);

  // Theme change
  const handleThemeChange = useCallback((newTheme: NoteTheme) => {
    setTheme(newTheme);
    onThemeChange?.(newTheme);
  }, [onThemeChange]);

  // Show author toggle
  const handleShowAuthorToggle = useCallback(() => {
    const newValue = !showAuthor;
    setShowAuthor(newValue);
    onShowAuthorChange?.(newValue);
  }, [showAuthor, onShowAuthorChange]);

  // Content change
  const handleInput = useCallback(() => {
    const content = contentRef.current?.innerHTML || '';
    onContentChange?.(content);
  }, [onContentChange]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { width, height };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;
      const newWidth = Math.max(MIN_WIDTH, startSize.current.width + deltaX);
      const newHeight = Math.max(MIN_HEIGHT, startSize.current.height + deltaY);
      setWidth(newWidth);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        onSizeChange?.(width, height);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, height, onSizeChange]);

  // Selection change listener
  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveFormats);
    return () => {
      document.removeEventListener('selectionchange', updateActiveFormats);
    };
  }, [updateActiveFormats]);

  // Set initial content
  useEffect(() => {
    if (contentRef.current && initialContent) {
      contentRef.current.innerHTML = initialContent;
    }
  }, [initialContent]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'rounded-lg border-2 shadow-lg overflow-hidden flex flex-col',
        colors.bg,
        colors.border
      )}
      style={{ width, height }}
    >
      {/* Toolbar */}
      <div className={cn('flex items-center gap-1 px-2 py-1 border-b', colors.toolbar, colors.border)}>
        {/* Format buttons */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 hover:bg-black/10',
            activeFormats.has('bold') && 'bg-black/10'
          )}
          onClick={() => handleFormat('bold')}
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 hover:bg-black/10',
            activeFormats.has('italic') && 'bg-black/10'
          )}
          onClick={() => handleFormat('italic')}
        >
          <Italic className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 hover:bg-black/10',
            activeFormats.has('underline') && 'bg-black/10'
          )}
          onClick={() => handleFormat('underline')}
        >
          <Underline className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-black/10"
          onClick={handleLink}
        >
          <Link className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 hover:bg-black/10',
            activeFormats.has('list') && 'bg-black/10'
          )}
          onClick={() => handleFormat('insertUnorderedList')}
        >
          <List className="h-3 w-3" />
        </Button>

        {/* Separator */}
        <div className="w-px h-4 bg-black/20 mx-1" />

        {/* Theme swatches */}
        <div className="flex items-center gap-1">
          {THEMES.map((t) => (
            <button
              key={t}
              className={cn(
                'w-4 h-4 rounded-full border transition-all',
                theme === t
                  ? 'ring-2 ring-offset-1 ring-gray-400'
                  : 'hover:scale-110'
              )}
              style={{ backgroundColor: THEME_COLORS[t].swatch }}
              onClick={() => handleThemeChange(t)}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-black/20 mx-1" />

        {/* Show author toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-black/10"
          onClick={handleShowAuthorToggle}
        >
          {showAuthor ? (
            <Eye className="h-3 w-3" />
          ) : (
            <EyeOff className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        contentEditable
        className={cn(
          'flex-1 p-3 text-xs focus:outline-none overflow-auto',
          colors.text
        )}
        onInput={handleInput}
        onBlur={onBlur}
        suppressContentEditableWarning
      />

      {/* Author signature */}
      {showAuthor && author && (
        <div className={cn('px-3 pb-2 text-[10px] opacity-60', colors.text)}>
          — {author}
        </div>
      )}

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize flex items-center justify-center"
        onMouseDown={handleResizeStart}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          className="opacity-40"
        >
          <path
            d="M7 1L1 7M7 4L4 7M7 7L7 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

// Demo component
export function NoteNodeEditorDemo() {
  const [content, setContent] = useState('这是一个便利贴示例。\n\n可以编辑内容、更换主题色、调整大小。');
  const [theme, setTheme] = useState<NoteTheme>('yellow');
  const [size, setSize] = useState({ width: 280, height: 200 });
  const [showAuthor, setShowAuthor] = useState(true);

  return (
    <div className="p-8 bg-muted/30 min-h-screen">
      <h2 className="text-lg font-semibold mb-4">NoteNode 编辑器</h2>
      <p className="text-sm text-muted-foreground mb-6">
        双击便利贴进入编辑模式。支持富文本格式、8种主题色、可调整大小。
      </p>

      <div className="relative inline-block">
        <NoteNodeEditor
          initialContent={content}
          initialTheme={theme}
          initialWidth={size.width}
          initialHeight={size.height}
          author="张三"
          showAuthor={showAuthor}
          onContentChange={setContent}
          onThemeChange={setTheme}
          onSizeChange={(w, h) => setSize({ width: w, height: h })}
          onShowAuthorChange={setShowAuthor}
        />
      </div>

      <div className="mt-8 p-4 bg-background rounded-lg border">
        <h3 className="text-sm font-medium mb-2">当前状态</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>主题: {theme}</p>
          <p>尺寸: {size.width} x {size.height}</p>
          <p>显示作者: {showAuthor ? '是' : '否'}</p>
        </div>
      </div>
    </div>
  );
}

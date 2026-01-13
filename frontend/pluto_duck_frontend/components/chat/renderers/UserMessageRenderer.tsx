'use client';

import { memo, useState } from 'react';
import { CopyIcon, CheckIcon } from 'lucide-react';
import { Actions, Action } from '../../ai-elements/actions';
import type { UserMessageItem } from '../../../types/chatRenderItem';

/**
 * 텍스트에서 @mention을 하이라이트하여 렌더링
 */
function renderTextWithMentions(text: string): React.ReactNode {
  const mentionRegex = /@([\w-]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={key++} className="text-primary-foreground/60 font-medium">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

export interface UserMessageRendererProps {
  item: UserMessageItem;
  onEdit?: (messageId: string, content: string) => void;
  onCopy?: (text: string) => void;
}

export const UserMessageRenderer = memo(function UserMessageRenderer({
  item,
  onCopy,
}: UserMessageRendererProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (onCopy) {
      onCopy(item.content);
    } else {
      void navigator.clipboard.writeText(item.content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="rounded-xl bg-muted px-4 py-2.5 text-foreground max-w-[80%]">
        <p className="text-sm whitespace-pre-wrap">
          {renderTextWithMentions(item.content)}
        </p>
      </div>
      <Actions className="opacity-0 transition-opacity group-hover:opacity-100 mr-2">
        <Action onClick={handleCopy} tooltip={copied ? 'Copied' : 'Copy'} className="size-6 p-1 text-muted-foreground/50 hover:text-muted-foreground">
          {copied ? <CheckIcon className="size-2.5" strokeWidth={1.5} /> : <CopyIcon className="size-2.5" strokeWidth={1.5} />}
        </Action>
      </Actions>
    </div>
  );
});

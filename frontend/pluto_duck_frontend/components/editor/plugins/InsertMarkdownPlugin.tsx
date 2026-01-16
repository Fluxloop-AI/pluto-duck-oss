'use client';

import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { $getRoot, $createParagraphNode, $insertNodes } from 'lexical';

export interface InsertMarkdownHandle {
  insertMarkdown: (content: string) => void;
}

export const InsertMarkdownPlugin = forwardRef<InsertMarkdownHandle>(
  function InsertMarkdownPlugin(_, ref) {
    const [editor] = useLexicalComposerContext();

    useImperativeHandle(ref, () => ({
      insertMarkdown: (content: string) => {
        editor.update(() => {
          // Create a temporary root to convert markdown
          const nodes = $convertFromMarkdownString(content, TRANSFORMERS);

          // Get the root and append nodes at the end
          const root = $getRoot();

          // If the editor is empty (only has one empty paragraph), clear it first
          const children = root.getChildren();
          if (
            children.length === 1 &&
            children[0].getType() === 'paragraph' &&
            children[0].getTextContent() === ''
          ) {
            children[0].remove();
          }

          // Append each node from the converted markdown
          if (Array.isArray(nodes)) {
            for (const node of nodes) {
              root.append(node);
            }
          }

          // Add a trailing paragraph for continued editing
          const trailingParagraph = $createParagraphNode();
          root.append(trailingParagraph);
          trailingParagraph.select();
        });
      },
    }));

    return null;
  }
);

import React from 'react';
import { EditorContent } from '@tiptap/react';
import { useTenTap, TenTapStartKit, BridgeExtension } from '@10play/tentap-editor/web';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { BlockDragHandle } from './blockDragHandle';
import { OutlineIndent } from './OutlineIndent';
import { ImageLongPress } from './imageLongPress';
import { ProjectoLink } from './projectoLink';
import { LinkClick } from './linkClick';

// Mirrors tentap's own Tiptap.tsx whitelist filtering of the default bridges.
const tenTapExtensions = TenTapStartKit.filter(
  (e) =>
    !window.whiteListBridgeExtensions ||
    window.whiteListBridgeExtensions.includes(e.name)
);

// Custom bridge: surfaces whether the caret is inside a table into the editor
// state sent to RN. No tiptap extension (Table is already added below via
// tiptapOptions), so it just contributes a field through extendEditorState.
// useTenTap reduces extendEditorState over every bridge regardless of the
// bridgeExtensionConfigMap, so no RN-side registration is required.
const tableStateBridge = new BridgeExtension({
  forceName: 'tableState',
  extendEditorState: (editor) => ({
    isInTable: editor.isActive('table'),
  }),
});

export default function Editor() {
  const editor = useTenTap({
    bridges: [...tenTapExtensions, tableStateBridge],
    // Raw TipTap extensions are spread straight into the editor by useTenTap.
    // This is what adds the Table nodes to the ProseMirror schema so that
    // <table> HTML from the web version parses, renders, and stays editable.
    // resizable: false — column-resize handles are useless on touch and our
    // goal is display + in-cell text editing only (no structure toolbar).
    tiptapOptions: {
      extensions: [
        Table.configure({
          resizable: false,
          HTMLAttributes: { class: 'tiptap-table' },
        }),
        TableRow,
        TableCell,
        TableHeader,
        BlockDragHandle,
        OutlineIndent,
        ImageLongPress,
        ProjectoLink,
        LinkClick,
      ],
    },
  });

  // Expose the editor so the RN side can run bundle commands (indent/outdent)
  // via webviewRef.injectJavaScript("window.__editor.chain()...").
  if (typeof window !== 'undefined') {
    window.__editor = editor;
  }

  return (
    <EditorContent
      editor={editor}
      className={window.dynamicHeight ? 'dynamic-height' : undefined}
    />
  );
}

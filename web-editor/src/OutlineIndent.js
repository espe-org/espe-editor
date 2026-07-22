import { Extension } from '@tiptap/core';
// Import ProseMirror view/state from tentap's re-export (NOT @tiptap/pm/*) so the
// bundle uses ONE prosemirror-view copy. A second copy makes our DecorationSet
// clash with prosemirror-tables' decorations on insertTable → "localsInner"
// crash (tiptap#3869). tentap re-exports the canonical pm here.
import {
  Plugin,
  PluginKey,
  TextSelection,
  Decoration,
  DecorationSet,
} from '@10play/tentap-editor/web';

const pluginKey = new PluginKey('outlineCollapse');

export const OutlineIndent = Extension.create({
  name: 'outlineIndent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      maxIndent: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const v = parseInt(element.getAttribute('data-indent') || '0', 10);
              return Number.isFinite(v) && v > 0 ? v : 0;
            },
            renderHTML: (attributes) =>
              attributes.indent ? { 'data-indent': attributes.indent } : {},
          },
          collapsed: {
            default: false,
            parseHTML: (element) =>
              element.getAttribute('data-collapsed') === 'true',
            renderHTML: (attributes) =>
              attributes.collapsed ? { 'data-collapsed': 'true' } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const { types, maxIndent } = this.options;

    const applyDelta = (delta) => ({ state, dispatch }) => {
      const { tr, doc, selection } = state;
      const { from, to } = selection;
      let changed = false;
      let prevIndent = -1; // running indent of previous top-level target block

      doc.forEach((node, offset) => {
        if (!types.includes(node.type.name)) {
          prevIndent = 0;
          return;
        }
        const start = offset;
        const end = offset + node.nodeSize;
        const inSel = start < to && end > from;
        const cur = node.attrs.indent || 0;
        let effective = cur;
        if (inSel) {
          let next = cur + delta;
          if (next < 0) next = 0;
          if (next > maxIndent) next = maxIndent;
          if (next > prevIndent + 1) next = prevIndent + 1; // can't jump >1 deeper
          if (next !== cur) {
            tr.setNodeMarkup(start, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
          effective = next;
        }
        prevIndent = effective;
      });

      if (changed && dispatch) dispatch(tr);
      return changed;
    };

    return {
      indentBlock: () => applyDelta(1),
      outdentBlock: () => applyDelta(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      // New line inherits the current line's indent (only when indented, so
      // non-outline editing keeps default Enter behavior).
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        const indent = ($from.parent.attrs && $from.parent.attrs.indent) || 0;
        if (!indent) return false;
        return editor
          .chain()
          .splitBlock()
          .command(({ tr }) => {
            const pos = tr.selection.$from.before();
            const node = tr.doc.nodeAt(pos);
            if (node && node.attrs && 'indent' in node.attrs) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
            }
            return true;
          })
          .run();
      },
    };
  },

  addProseMirrorPlugins() {
    const { types } = this.options;

    const buildDecorations = (doc) => {
      const decos = [];
      const items = [];
      doc.forEach((node, offset) => items.push({ node, offset }));

      for (let i = 0; i < items.length; i++) {
        const { node, offset } = items[i];
        if (!types.includes(node.type.name)) continue;
        const indent = node.attrs.indent || 0;
        const next = items[i + 1];
        const hasChildren =
          !!next &&
          types.includes(next.node.type.name) &&
          (next.node.attrs.indent || 0) > indent;

        if (hasChildren) {
          const collapsed = !!node.attrs.collapsed;
          const parentOffset = offset;
          const parentNode = node;
          decos.push(
            Decoration.widget(
              offset + 1,
              (view) => {
                const span = document.createElement('span');
                span.className = 'oc-chevron';
                span.textContent = collapsed ? '▸' : '▾';
                span.contentEditable = 'false';
                span.addEventListener('pointerdown', (e) => {
                  e.preventDefault();
                  let tr = view.state.tr.setNodeMarkup(parentOffset, undefined, {
                    ...parentNode.attrs,
                    collapsed: !collapsed,
                  });
                  if (!collapsed) {
                    // collapsing → move caret to the parent so it doesn't sit
                    // inside the soon-to-be-hidden range
                    const endInsideParent = Math.min(
                      parentOffset + parentNode.nodeSize - 1,
                      tr.doc.content.size
                    );
                    tr = tr.setSelection(
                      TextSelection.near(tr.doc.resolve(endInsideParent), -1)
                    );
                  }
                  view.dispatch(tr);
                });
                return span;
              },
              { side: -1, key: `oc-chev-${offset}-${node.attrs.collapsed ? 1 : 0}` }
            )
          );
        }

        if (node.attrs.collapsed && hasChildren) {
          for (let j = i + 1; j < items.length; j++) {
            const c = items[j];
            const cIndent = c.node.attrs.indent || 0;
            if (!types.includes(c.node.type.name) || cIndent <= indent) break;
            decos.push(
              Decoration.node(c.offset, c.offset + c.node.nodeSize, {
                class: 'oc-hidden',
              })
            );
          }
        }
      }
      return DecorationSet.create(doc, decos);
    };

    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            return buildDecorations(state.doc);
          },
        },
      }),
    ];
  },
});

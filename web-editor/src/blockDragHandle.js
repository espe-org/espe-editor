/* eslint-env browser */
import { Extension } from '@tiptap/core';
// Import ProseMirror view/state from tentap's re-export (NOT @tiptap/pm/*) so the
// bundle uses ONE prosemirror-view copy — a second copy makes DecorationSet clash
// with prosemirror-tables on insertTable ("localsInner" crash, tiptap#3869).
import {
  Plugin,
  PluginKey,
  TextSelection,
  Decoration,
  DecorationSet,
} from '@10play/tentap-editor/web';

const pluginKey = new PluginKey('blockDragHandle');

// Drag handles are offered on the outline block types. The reorder still works
// across all top-level nodes (indices are computed over the whole doc), you just
// can't START a drag from a table/list container.
const HANDLE_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'table',
];

function posBeforeChild(doc, index) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
  return pos;
}

// Doc position INSIDE the first textblock leaf of a top-level node. For a
// textblock (paragraph/heading) that is the node itself; for a container
// (list/table) it is the first paragraph inside the first item/cell. Returns
// null for nodes with no textblock (atoms/leaves), which then get no handle.
function firstTextblockInnerPos(node, offset) {
  if (node.isTextblock) return offset + 1;
  let inner = null;
  node.descendants((child, pos) => {
    if (inner !== null) return false;
    if (child.isTextblock) {
      inner = offset + 1 + pos + 1;
      return false;
    }
    return true;
  });
  return inner;
}

// Drives the drag gesture and the drop indicator. The handles themselves are
// widget decorations (see buildHandleDecorations) living INSIDE the editor, so
// they need no measurement/positioning here — they move with their block.
class DragController {
  constructor(view) {
    this.view = view;
    this.drag = null;
    this.activeHandle = null;

    // The drop indicator is only visible during an active drag (content isn't
    // reflowing then), so a viewport-positioned body element is safe here.
    this.indicator = document.createElement('div');
    this.indicator.className = 'block-drop-indicator';
    this.indicator.style.position = 'fixed';
    this.indicator.style.display = 'none';
    this.indicator.style.zIndex = '41';
    document.body.appendChild(this.indicator);

    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
  }

  // Offset between pointer clientY (visual viewport) and getBoundingClientRect
  // (layout viewport). On iOS WKWebView with the keyboard up these diverge by
  // the keyboard offset; visualViewport.offsetTop is that amount (≈0 on desktop).
  vvOffset() {
    return window.visualViewport ? window.visualViewport.offsetTop : 0;
  }

  // Top-level block index whose layout rect contains the (already-corrected) y.
  blockIndexAtY(y) {
    const doc = this.view.state.doc;
    const count = doc.childCount;
    for (let i = 0; i < count; i++) {
      const dom = this.view.nodeDOM(posBeforeChild(doc, i));
      if (!dom || dom.nodeType !== 1) continue;
      const r = dom.getBoundingClientRect();
      if (y < r.bottom) return i;
    }
    return count - 1;
  }

  startDrag(e) {
    if (!this.view.editable) return;
    e.preventDefault();
    e.stopPropagation();
    // Determine the source block from the touch COORDINATES, not from which
    // handle element received the event: on iOS WKWebView the element hit-test
    // is offset (the press lands on a handle several rows away), but the pointer
    // coordinates stay consistent with getBoundingClientRect, so coordinates are
    // reliable. visualViewport.offsetTop corrects any keyboard scroll offset.
    const correctedY = e.clientY + this.vvOffset();
    const sourceIndex = this.blockIndexAtY(correctedY);
    if (sourceIndex < 0) return;

    this.drag = { sourceIndex, dropIndex: null };

    // Grabbing a handle dismisses the keyboard (same effect as Cmd+K), which
    // resyncs the iOS visual viewport so the drop is computed in a stable state.
    // Source was already captured above, before this blur changes the viewport.
    this.view.dom.blur();

    // Highlight the ACTUAL source handle. The pressed element may be a different
    // handle (hit-test offset), so we don't rely on CSS :active.
    const srcDom = this.view.nodeDOM(
      posBeforeChild(this.view.state.doc, sourceIndex)
    );
    this.activeHandle =
      srcDom && srcDom.querySelector
        ? srcDom.querySelector('.block-drag-handle')
        : null;
    if (this.activeHandle) this.activeHandle.classList.add('dragging');

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    document.addEventListener('pointermove', this.onMove, { passive: false });
    document.addEventListener('pointerup', this.onUp);
    document.addEventListener('pointercancel', this.onUp);
  }

  computeDropIndex(clientY) {
    const doc = this.view.state.doc;
    const count = doc.childCount;
    for (let i = 0; i < count; i++) {
      const dom = this.view.nodeDOM(posBeforeChild(doc, i));
      if (!dom || dom.nodeType !== 1) continue;
      const r = dom.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return count;
  }

  showIndicator(dropIndex) {
    const view = this.view;
    const doc = view.state.doc;
    const count = doc.childCount;
    const rectAt = (i) => {
      const dom = view.nodeDOM(posBeforeChild(doc, i));
      return dom && dom.nodeType === 1 ? dom.getBoundingClientRect() : null;
    };
    // Sit the line in the GAP between blocks, not on a block's top edge.
    let top;
    if (dropIndex >= count) {
      const last = rectAt(count - 1);
      top = last ? last.bottom : 0;
    } else if (dropIndex <= 0) {
      const first = rectAt(0);
      top = first ? first.top : 0;
    } else {
      const prev = rectAt(dropIndex - 1);
      const cur = rectAt(dropIndex);
      if (prev && cur) top = (prev.bottom + cur.top) / 2;
      else top = (cur || prev).top;
    }
    const pmRect = view.dom.getBoundingClientRect();
    this.indicator.style.display = 'block';
    this.indicator.style.top = top + 'px';
    this.indicator.style.left = pmRect.left + 12 + 'px';
    this.indicator.style.width = Math.max(0, pmRect.width - 12) + 'px';
  }

  onMove(e) {
    if (!this.drag) return;
    e.preventDefault();
    // Convert the pointer's (visual-viewport) clientY into layout-viewport space
    // so it compares correctly against block getBoundingClientRect values.
    const dropIndex = this.computeDropIndex(e.clientY + this.vvOffset());
    this.drag.dropIndex = dropIndex;
    this.showIndicator(dropIndex);
  }

  onUp() {
    const drag = this.drag;
    this.drag = null;
    this.indicator.style.display = 'none';
    if (this.activeHandle) {
      this.activeHandle.classList.remove('dragging');
      this.activeHandle = null;
    }
    document.removeEventListener('pointermove', this.onMove);
    document.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('pointercancel', this.onUp);
    if (!drag || drag.dropIndex == null) return;

    const { sourceIndex, dropIndex } = drag;
    // no-op: dropping back into its own slot
    if (dropIndex === sourceIndex || dropIndex === sourceIndex + 1) return;

    const view = this.view;
    const state = view.state;
    const doc = state.doc;
    const node = doc.child(sourceIndex);
    const from = posBeforeChild(doc, sourceIndex);
    const to = from + node.nodeSize;
    const insertAt = posBeforeChild(doc, dropIndex);

    let tr = state.tr.delete(from, to);
    const mapped = tr.mapping.map(insertAt);
    tr = tr.insert(mapped, node);
    const sel = TextSelection.near(
      tr.doc.resolve(Math.min(mapped + 1, tr.doc.content.size))
    );
    tr = tr.setSelection(sel).scrollIntoView();
    view.dispatch(tr);
    // Intentionally do NOT view.focus() here: the grab dismissed the keyboard,
    // and re-focusing would immediately bring it back. The caret is set; the
    // user taps to resume editing.
  }

  destroy() {
    document.removeEventListener('pointermove', this.onMove);
    document.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('pointercancel', this.onUp);
    this.indicator.remove();
  }
}

// One handle widget per outline block, rendered as a <span> child of the block
// (a <div> would break the parent <p>). CSS anchors it to the block's right edge.
function buildHandleDecorations(doc, controllerRef) {
  const decos = [];
  doc.forEach((node, offset, index) => {
    if (!HANDLE_TYPES.includes(node.type.name)) return;
    const pos = firstTextblockInnerPos(node, offset);
    if (pos == null) return; // no textblock leaf to host the <span>
    decos.push(
      Decoration.widget(
        pos,
        () => {
          const el = document.createElement('span');
          el.className = 'block-drag-handle';
          el.textContent = '⋮';
          el.contentEditable = 'false';
          el.addEventListener('pointerdown', (e) => {
            const c = controllerRef.current;
            if (c) c.startDrag(e);
          });
          return el;
        },
        { side: -1, key: 'drag-' + index }
      )
    );
  });
  return DecorationSet.create(doc, decos);
}

export const BlockDragHandle = Extension.create({
  name: 'blockDragHandle',
  addProseMirrorPlugins() {
    // Shared holder so the decoration's pointerdown can reach the controller
    // created in the plugin view (read lazily at event time).
    const controllerRef = { current: null };
    return [
      new Plugin({
        key: pluginKey,
        view: (view) => {
          controllerRef.current = new DragController(view);
          return {
            destroy: () => {
              if (controllerRef.current) controllerRef.current.destroy();
              controllerRef.current = null;
            },
          };
        },
        props: {
          decorations(state) {
            return buildHandleDecorations(state.doc, controllerRef);
          },
        },
      }),
    ];
  },
});

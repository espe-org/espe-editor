/* eslint-env browser */
// Long-press an image in the editor → ask the RN side to open it full-screen.
// The actual viewer is a native Modal (see EditorScreen.jsx) so it can cover the
// whole device screen; here we only detect the gesture and post the image src.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@10play/tentap-editor/web';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

function postPreview(src) {
  if (src && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'imagePreview', payload: { src } })
    );
  }
}

export const ImageLongPress = Extension.create({
  name: 'imageLongPress',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('imageLongPress'),
        view(view) {
          const dom = view.dom;

          // Suppress the iOS native long-press callout / selection on images so
          // our own long-press gesture is the only thing that fires.
          const style = document.createElement('style');
          style.textContent =
            '.ProseMirror img{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}';
          document.head.appendChild(style);

          let timer = null;
          let startX = 0;
          let startY = 0;
          let src = null;
          const clear = () => {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
          };

          const onStart = (e) => {
            const t = e.target;
            if (!t || t.tagName !== 'IMG') return;
            const p = e.touches && e.touches[0] ? e.touches[0] : e;
            startX = p.clientX;
            startY = p.clientY;
            src = t.getAttribute('src');
            clear();
            timer = setTimeout(() => {
              timer = null;
              postPreview(src);
            }, LONG_PRESS_MS);
          };
          const onMove = (e) => {
            if (!timer) return;
            const p = e.touches && e.touches[0] ? e.touches[0] : e;
            if (
              Math.abs(p.clientX - startX) > MOVE_TOLERANCE ||
              Math.abs(p.clientY - startY) > MOVE_TOLERANCE
            ) {
              clear();
            }
          };
          const onEnd = () => clear();
          // Desktop / browser fallback: right-click (contextmenu) opens it too.
          const onCtx = (e) => {
            const t = e.target;
            if (t && t.tagName === 'IMG') {
              e.preventDefault();
              postPreview(t.getAttribute('src'));
            }
          };

          dom.addEventListener('touchstart', onStart, { passive: true });
          dom.addEventListener('touchmove', onMove, { passive: true });
          dom.addEventListener('touchend', onEnd);
          dom.addEventListener('touchcancel', onEnd);
          dom.addEventListener('contextmenu', onCtx);

          return {
            destroy() {
              clear();
              dom.removeEventListener('touchstart', onStart);
              dom.removeEventListener('touchmove', onMove);
              dom.removeEventListener('touchend', onEnd);
              dom.removeEventListener('touchcancel', onEnd);
              dom.removeEventListener('contextmenu', onCtx);
              style.remove();
            },
          };
        },
      }),
    ];
  },
});

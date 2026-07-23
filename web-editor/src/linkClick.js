/* eslint-env browser */
// Intercepts a tap on any hyperlink in the content and hands it to RN
// (RichEditor.tsx's onLinkPress, default Linking.openURL) instead of letting
// the WebView navigate. Uses ProseMirror's own handleClick editor prop
// (not a raw document click listener) so it composes correctly with
// ProseMirror's click/selection handling. Independent of projectoLink.js's
// own click handling — that card is a block-level div with its own
// listener, not an inline <a> mark, so there's no overlap.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@10play/tentap-editor/web';

export const LinkClick = Extension.create({
  name: 'linkClick',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('linkClick'),
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target;
            const link = target && target.closest ? target.closest('a') : null;
            if (link && link.href) {
              event.preventDefault();
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: 'linkPress', payload: { href: link.href } }),
                );
              }
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

# espe-editor

ESPE rich-text editor for React-Native — a native `RichText`/`Toolbar` wrapper around
[`@10play/tentap-editor`](https://github.com/10play/10tap-editor) with table support,
block drag-and-drop, indent/outdent, and text color/highlight, backed by a bundled
Tiptap WebView build (`web-editor/`).

## Install

Add as a git dependency in `package.json`:

```json
"dependencies": {
  "espe-editor": "https://github.com/espe-org/espe-editor"
}
```

Peer dependencies (install alongside, matching your app's versions):

```
react
react-native
react-native-webview
@10play/tentap-editor
```

## Usage

```tsx
import { useRef } from "react";
import RichEditor, { RichEditorRef } from "espe-editor";

function Screen() {
  const editorRef = useRef<RichEditorRef>(null);

  return (
    <RichEditor
      ref={editorRef}
      initialContent="<h2>Hello!</h2>"
      onChangeHTML={(html) => console.log(html)}
      onRequestImage={async () => {
        // Show your own image picker / camera UI here, return a data-URI or URL.
        return null;
      }}
    />
  );
}
```

### Scope

This library owns the core editing surface only: the toolbar, tables, text
color/highlight, drag-to-reorder blocks, and the WebView bundle. Image picking
(camera/gallery permissions) and document I/O (save/load/share/clipboard) are
deliberately left to the consuming app — wire them up via `onRequestImage` and
the imperative ref (`getHTML()` / `setContent()`).

## API

### `RichEditorProps`

| Prop             | Type                                            | Notes |
|-------------------|--------------------------------------------------|-------|
| `initialContent`  | `string`                                          | Uncontrolled initial HTML, read on mount only. |
| `onChangeHTML`     | `(html: string) => void`                          | Debounced (300ms) live content changes. |
| `value`            | `string`                                          | Lightly-controlled: pushes `setContent(value)` only when it differs from the last self-emitted `onChangeHTML` value, to avoid fighting the user's cursor. |
| `placeholder`      | `string`                                          | |
| `autofocus`        | `boolean`                                         | Defaults to `true`. |
| `editable`         | `boolean`                                         | Defaults to `true`. |
| `onRequestImage`   | `() => Promise<string \| null \| undefined>`      | Called when the toolbar's image button is pressed. The image button is hidden entirely if this prop is omitted. |
| `onImagePress`     | `(src: string) => void`                           | Overrides the built-in full-screen image-preview modal (triggered by long-pressing an image). |
| `style`            | `StyleProp<ViewStyle>`                            | Wraps the editor + toolbar container. |

### `RichEditorRef`

| Method       | Signature                                             |
|--------------|--------------------------------------------------------|
| `getHTML`    | `() => Promise<string>`                                 |
| `setContent` | `(html: string) => void`                                 |
| `focus`      | `(pos?: 'start' \| 'end' \| 'all' \| number) => void`     |
| `blur`       | `() => void`                                             |
| `runCommand` | `(expr: string) => void` — escape hatch, e.g. `"indentBlock()"` run inside the WebView bundle. |

## Development

The rich-text surface (tables, indent/outdent, block drag handle, image
long-press) is a Tiptap bundle built from `web-editor/` (Vite) and committed
as `src/generated/editorHtml.ts`. After changing anything under `web-editor/`,
regenerate it and commit the result alongside your change:

```sh
yarn build:web
```

See `CONTRIBUTING.md` for the release process (`yarn bump`).

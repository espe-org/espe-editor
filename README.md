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
        // Show your own gallery picker here, return a data-URI or URL.
        return null;
      }}
      onRequestCamera={async () => {
        // Show your own camera UI here, return a data-URI or URL.
        return null;
      }}
    />
  );
}
```

### Full example (every prop)

```tsx
import { useRef, useState } from "react";
import { View } from "react-native";
import RichEditor, { RichEditorRef } from "espe-editor";

function Screen() {
  const editorRef = useRef<RichEditorRef>(null);
  const [html, setHtml] = useState<string | undefined>(undefined);
  const [contentHeight, setContentHeight] = useState(0);

  return (
    <View style={{ maxHeight: 400 }}>
      <RichEditor
        ref={editorRef}
        // --- Content ---
        initialContent="<h2>Hello!</h2><p>Start typing…</p>"
        // Omit `value` entirely for fully uncontrolled mode. Only pass it for
        // lightly-controlled sync (e.g. restoring content from elsewhere) —
        // echoing back the same string you just got from onChangeHTML is a
        // no-op, so it won't fight the user's cursor while they type.
        value={html}
        onChangeHTML={setHtml} // debounced 300ms
        placeholder="Введите текст..."
        autofocus={true} // default
        editable={true} // default

        // --- Images ---
        // Toolbar's image button renders when onRequestImage and/or
        // onRequestCamera is supplied. With both, pressing it first shows the
        // platform's system chooser ("Выбрать из галереи" / "Снять фото");
        // with only one, that one opens directly.
        onRequestImage={async () => {
          // Show your own gallery picker, return a data-URI or URL (or null to cancel).
          return null;
        }}
        onRequestCamera={async () => {
          // Show your own camera UI, return a data-URI or URL (or null to cancel).
          return null;
        }}
        onImagePress={(src) => console.log("image tapped:", src)} // optional; overrides the built-in preview modal

        // --- Projecto link cards ---
        // Detection/rendering of pasted "/api/web/share/" links is always on;
        // this is just an escape hatch for in-app navigation on tap.
        onProjectoLinkPress={(taskUrl) => console.log("projecto card tapped:", taskUrl)}

        // --- Generic link taps (any other <a> in the content) ---
        onLinkPress={(href) => console.log("link tapped:", href)}

        // --- Color pickers ---
        textColors={[null, "#e03131", "#2f9e44", "#1971c2"]} // first entry = "reset to default"
        highlightColors={[null, "#ffec99", "#b2f2bb", "#a5d8ff"]}

        // --- Embeddable / auto-size layout ---
        // Pair dynamicHeight with toolbarPosition "top"/"bottom", not "floating".
        dynamicHeight
        onContentHeightChange={setContentHeight}

        // --- Toolbar composition & placement ---
        toolbarPosition="bottom" // "floating" (default) | "top" | "bottom"
        toolbarActions={["bold", "italic", "underline", "link", "table", "image"]} // omit for the full default set

        // --- Focus tracking ---
        onFocus={() => console.log("focused")}
        onBlur={() => console.log("blurred")}

        // --- Theming ---
        colorScheme="dark" // "light" (default) | "dark" — pair with your app's own dark-mode state

        // --- Layout ---
        style={{ backgroundColor: "transparent" }}
      />
    </View>
  );
}
```

### Scope

This library owns the core editing surface only: the toolbar, tables, text
color/highlight, drag-to-reorder blocks, and the WebView bundle. Image picking
(camera/gallery permissions) and document I/O (save/load/share/clipboard) are
deliberately left to the consuming app — wire them up via `onRequestImage` /
`onRequestCamera` and the imperative ref (`getHTML()` / `setContent()`). The
only picking UI the library owns is the system sheet asking *which* of those
two sources to use.

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
| `onRequestImage`   | `() => Promise<string \| null \| undefined>`      | Gallery source for the toolbar's image button. |
| `onRequestCamera`  | `() => Promise<string \| null \| undefined>`      | Camera source for the toolbar's image button. The button is hidden entirely unless at least one of the two is supplied; with both, pressing it shows the system source chooser (`ActionSheetIOS` on iOS, `Alert` on Android) first. |
| `onImagePress`     | `(src: string) => void`                           | Overrides the built-in full-screen image-preview modal (triggered by long-pressing an image). |
| `onProjectoLinkPress` | `(taskUrl: string) => void`                   | Tap handler for resolved Projecto task-share cards (detection is always on). Defaults to `Linking.openURL`. |
| `onLinkPress`      | `(href: string) => void`                          | Tap handler for any other hyperlink in the content. Defaults to `Linking.openURL`. |
| `textColors`       | `(string \| null)[]`                              | Swatches for the text-color toolbar picker. First entry `null` = "reset to default". |
| `highlightColors`  | `(string \| null)[]`                              | Swatches for the highlight toolbar picker. Same `null`-first convention. |
| `dynamicHeight`    | `boolean`                                         | Size the WebView to its own content instead of `flex: 1`, for embedding inline in a scrollable screen. Pair with `toolbarPosition: "top"/"bottom"`, not `"floating"`. |
| `onContentHeightChange` | `(height: number) => void`                   | Fires on document height changes. Only meaningful with `dynamicHeight`. |
| `toolbarPosition`  | `"floating" \| "top" \| "bottom"`                 | Defaults to `"floating"` (absolute, keyboard-tracked, auto-hides while unfocused). `"top"`/`"bottom"` dock it in normal flow, always visible. |
| `toolbarActions`   | `ToolbarAction[]`                                 | Restricts the toolbar to these actions. Omit for the full default set. `"image"` still additionally requires `onRequestImage` or `onRequestCamera`. |
| `onFocus`          | `() => void`                                      | |
| `onBlur`           | `() => void`                                      | |
| `colorScheme`      | `"light" \| "dark"`                               | Defaults to `"light"`. Switches the editor's own built-in theme/CSS; pair with your app's dark-mode state. |
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

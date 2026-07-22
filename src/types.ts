import type { StyleProp, ViewStyle } from "react-native";

export interface RichEditorProps {
	/** Uncontrolled initial WebView doc content (HTML). Only read on mount. */
	initialContent?: string;

	/** Fired on every debounced ProseMirror change (wraps tentap's built-in
	 * onChange bridge event + editor.getHTML()). Not fired for programmatic
	 * setContent() calls this component makes itself in response to `value`. */
	onChangeHTML?: (html: string) => void;

	/** Optional lightly-controlled mode. When provided and its value differs
	 * from the last HTML this component itself emitted via onChangeHTML, the
	 * component calls setContent(value). Passing back the same string you
	 * just received via onChangeHTML is always a no-op — this is what
	 * prevents cursor-position fights while typing. Omit this prop entirely
	 * to use RichEditor as fully uncontrolled (initialContent only). */
	value?: string;

	placeholder?: string;
	autofocus?: boolean;
	editable?: boolean;

	/** Called when the toolbar's image button is pressed. The app owns the
	 * picker UI (camera/gallery/permissions) entirely; return a data-URI or
	 * remote URL to insert, or null/undefined to cancel. The image toolbar
	 * button is only rendered when this prop is supplied. */
	onRequestImage?: () => Promise<string | null | undefined>;

	/** Override the built-in full-screen image-preview modal (triggered by
	 * long-press inside the WebView). If omitted, RichEditor's own preview
	 * modal is used. */
	onImagePress?: (src: string) => void;

	/** Swatches for the text-color / highlight toolbar pickers. First entry
	 * should be `null` to represent "reset to default". */
	textColors?: (string | null)[];
	highlightColors?: (string | null)[];

	style?: StyleProp<ViewStyle>;
}

export interface RichEditorRef {
	getHTML: () => Promise<string>;
	setContent: (html: string) => void;
	focus: (pos?: "start" | "end" | "all" | number) => void;
	blur: () => void;
	/** Escape hatch: run a raw chain expression in the WebView bundle, e.g.
	 * "indentBlock()" — the same mechanism the table/indent buttons use
	 * internally. */
	runCommand: (expr: string) => void;
}

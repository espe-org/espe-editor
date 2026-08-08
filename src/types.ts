import type { StyleProp, ViewStyle } from "react-native";
import type { LocaleOption } from "./i18n";

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
	hideKeyboardCloseButton?: boolean;

	/** Called when the user picks "gallery" from the toolbar's image button.
	 * The app owns the picker UI (gallery/permissions) entirely; return a
	 * data-URI or remote URL to insert, or null/undefined to cancel. */
	onRequestImage?: () => Promise<string | null | undefined>;

	/** Called when the user picks "camera" from the toolbar's image button.
	 * Same contract as `onRequestImage` — the app owns the capture UI and
	 * permissions, and returns a data-URI or remote URL to insert.
	 *
	 * The image toolbar button renders when either this or `onRequestImage`
	 * is supplied. With both, pressing it first shows the platform's system
	 * chooser (an action sheet on iOS, an alert dialog on Android); with only
	 * one, that one is invoked directly with no intermediate sheet. */
	onRequestCamera?: () => Promise<string | null | undefined>;

	/** Override the built-in full-screen image-preview modal (triggered by
	 * long-press inside the WebView). If omitted, RichEditor's own preview
	 * modal is used. */
	onImagePress?: (src: string) => void;

	/** Called when a resolved Projecto task-share card is tapped. Detection
	 * and rendering of these cards (pasted/typed links containing
	 * "/api/web/share/") is always on, built into the editor — this prop is
	 * only an escape hatch for in-app navigation. If omitted, the task URL
	 * opens via Linking.openURL. */
	onProjectoLinkPress?: (taskUrl: string) => void;

	/** Swatches for the text-color / highlight toolbar pickers. First entry
	 * should be `null` to represent "reset to default". */
	textColors?: (string | null)[];
	highlightColors?: (string | null)[];

	/** Size the WebView to its own content instead of filling the parent
	 * (`flex: 1`) — for embedding RichEditor inline within a scrollable
	 * screen alongside other fields, rather than as the whole screen. Pair
	 * this with `toolbarPosition: "top"` or `"bottom"`, not `"floating"` —
	 * a keyboard-tracked floating toolbar has no coherent meaning inside a
	 * content-sized box. */
	dynamicHeight?: boolean;

	/** Fires whenever the WebView's document height changes. Only meaningful
	 * together with `dynamicHeight` — use it to resize/scroll an enclosing
	 * container, the way you'd size a wrapping View from this value. */
	onContentHeightChange?: (height: number) => void;

	/** Where the toolbar renders. `"floating"` (default) is today's
	 * behavior: absolutely positioned, tracks the keyboard, auto-hides while
	 * unfocused. `"top"`/`"bottom"` dock it in normal flow, always visible —
	 * for a statically-docked toolbar instead of one that floats above the
	 * keyboard. */
	toolbarPosition?: "floating" | "top" | "bottom";

	/** Restricts the toolbar to only these actions, in this order isn't
	 * guaranteed (built-ins render in their standard order). Omit to show
	 * the full default set (today's behavior). `"image"` still additionally
	 * requires `onRequestImage` or `onRequestCamera` to be supplied. */
	toolbarActions?: ToolbarAction[];

	/** Fired when the editor gains/loses focus — e.g. to track which of
	 * several editor instances on a screen is currently active. */
	onFocus?: () => void;
	onBlur?: () => void;

	/** Called when the user taps any hyperlink in the content (not the
	 * Projecto-card embeds — see onProjectoLinkPress for those). If omitted,
	 * the link opens via Linking.openURL. */
	onLinkPress?: (href: string) => void;

	/** Switches the editor's own built-in dark theme/CSS on or off. Defaults
	 * to "light". This does not affect anything outside the WebView — pair
	 * it with your app's own dark-mode state. */
	colorScheme?: "light" | "dark";

	/** Language of the strings this library renders itself: the table menus,
	 * the image-source sheet, and the Projecto card's loading placeholder.
	 * Defaults to `"ru"` — today's behavior — so this is opt-in. `"auto"`
	 * follows the device language via `Intl`, treating anything non-Russian
	 * as English (and falling back to `"ru"` if `Intl` is unavailable).
	 *
	 * This only covers the library's own chrome. Content, `placeholder`, and
	 * anything your app renders around the editor stay yours. */
	locale?: LocaleOption;

	style?: StyleProp<ViewStyle>;
}

export type ToolbarAction =
	| "bold"
	| "italic"
	| "underline"
	| "strike"
	| "link"
	| "checklist"
	| "heading"
	| "bulletList"
	| "orderedList"
	| "indent"
	| "outdent"
	| "undo"
	| "redo"
	| "textColor"
	| "highlight"
	| "image"
	| "table";

export interface RichEditorRef {
	getHTML: () => Promise<string>;
	/** Replaces the document. Safe to call before the editor has finished
	 * booting: content handed over early is held and applied as soon as the
	 * WebView is up, so a host can mount RichEditor ahead of its own data. */
	setContent: (html: string) => void;
	focus: (pos?: "start" | "end" | "all" | number) => void;
	blur: () => void;
	/** Escape hatch: run a raw chain expression in the WebView bundle, e.g.
	 * "indentBlock()" — the same mechanism the table/indent buttons use
	 * internally. */
	runCommand: (expr: string) => void;
}

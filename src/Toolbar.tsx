import {
	DEFAULT_TOOLBAR_ITEMS,
	Images,
	type EditorBridge,
	type ToolbarItem,
} from "@10play/tentap-editor";
import { HIGHLIGHT_ICON, IMAGE_ICON, KEYBOARD_ICON, TABLE_ICON } from "./icons";
import type { ToolbarAction } from "./types";

interface UseToolbarItemsArgs {
	editor: EditorBridge;
	runCommand: (expr: string) => void;
	hasImagePicker: boolean;
	onImagePress: () => void;
	onTextColorPress: () => void;
	onHighlightPress: () => void;
	onOpenTableMenu: () => void;
	onOpenTableSizeModal: () => void;
	/** Restrict to these actions. Omit for the full default set. */
	actions?: ToolbarAction[];
	hideKeyboardCloseButton?: boolean;
}

const isHidden = (it: ToolbarItem) =>
	it.image({} as any) === Images.code || it.image({} as any) === Images.quote;
const isUndoRedo = (it: ToolbarItem) =>
	it.image({} as any) === Images.undo || it.image({} as any) === Images.redo;

// Maps a ToolbarAction name to the tentap default item it corresponds to, for
// filtering DEFAULT_TOOLBAR_ITEMS by name — those items carry no name/id
// field of their own, only {onPress, active, disabled, image}.
const ACTION_IMAGE_MAP: Partial<Record<ToolbarAction, unknown>> = {
	bold: Images.bold,
	italic: Images.italic,
	underline: Images.underline,
	strike: Images.strikethrough,
	link: Images.link,
	checklist: Images.checkList,
	heading: Images.Aa,
	bulletList: Images.bulletList,
	orderedList: Images.orderedList,
	indent: Images.indent,
	outdent: Images.outdent,
	undo: Images.undo,
	redo: Images.redo,
};

function actionNameOf(item: ToolbarItem): ToolbarAction | undefined {
	const src = item.image({} as any);
	for (const name of Object.keys(ACTION_IMAGE_MAP) as ToolbarAction[]) {
		if (ACTION_IMAGE_MAP[name] === src) return name;
	}
	return undefined;
}

// Builds the native tentap toolbar items, customized:
//  - a keyboard-dismiss button is prepended (the native toolbar is only shown
//    while the keyboard is up, so this is always relevant; it also reveals
//    the drag handles, hidden while the keyboard is visible);
//  - the indent/outdent buttons (originally list sink/lift) are reassigned to
//    the OutlineIndent extension's block indent/outdent, via the WebView
//    bundle's chain commands, so they work on any block, not just list items;
//  - text-color / highlight buttons open a swatch picker (see ColorBar);
//  - an image button (only when `hasImagePicker` is true — i.e. the host app
//    supplied onRequestImage) opens the host's own picker;
//  - a table button is appended: outside a table it inserts one directly (a
//    one-item menu reads badly), inside a table it opens the structural-ops
//    menu.
export function useToolbarItems({
	editor,
	runCommand,
	hasImagePicker,
	onImagePress,
	onTextColorPress,
	onHighlightPress,
	onOpenTableMenu,
	onOpenTableSizeModal,
	actions,
	hideKeyboardCloseButton = false,
}: UseToolbarItemsArgs): ToolbarItem[] {
	const allowed = (action: ToolbarAction) => !actions || actions.includes(action);

	const keyboardItem: ToolbarItem = {
		onPress: () => () => editor.blur(),
		active: () => false,
		disabled: () => false,
		image: () => KEYBOARD_ICON,
	};

	// The live `isInTable` comes from the WebView bundle's tableState bridge
	// via editorState (see web-editor/src/Editor.jsx). Outside a table this
	// opens the size-picker modal; inside one it opens the structural-ops menu.
	const tableItem: ToolbarItem = {
		onPress:
			({ editorState }) =>
			() => {
				if ((editorState as any)?.isInTable) {
					onOpenTableMenu();
				} else {
					onOpenTableSizeModal();
				}
			},
		active: () => false,
		disabled: () => false,
		image: () => TABLE_ICON,
	};

	const textColorItem: ToolbarItem = {
		onPress: () => () => onTextColorPress(),
		active: () => false,
		disabled: () => false,
		image: () => Images.palette,
	};

	const highlightItem: ToolbarItem = {
		onPress: () => () => onHighlightPress(),
		active: () => false,
		disabled: () => false,
		image: () => HIGHLIGHT_ICON,
	};

	const imageItem: ToolbarItem = {
		onPress: () => () => onImagePress(),
		active: () => false,
		disabled: () => false,
		image: () => IMAGE_ICON,
	};

	// Standard buttons from tentap, minus code & blockquote (always hidden —
	// never exposed via `actions` either), with the indent/outdent buttons
	// reassigned to block indent, then filtered down to `actions` (if given).
	// image() on default items ignores its args, so matching by Images.* is
	// safe.
	const standardItems = DEFAULT_TOOLBAR_ITEMS.filter((it) => !isHidden(it))
		.map((item) => {
			const src = item.image({} as any);
			if (src === Images.indent) {
				return {
					...item,
					onPress: () => () => runCommand("indentBlock()"),
					active: () => false,
					disabled: () => false,
				};
			}
			if (src === Images.outdent) {
				return {
					...item,
					onPress: () => () => runCommand("outdentBlock()"),
					active: () => false,
					disabled: () => false,
				};
			}
			return item;
		})
		.filter((item) => {
			const name = actionNameOf(item);
			return name ? allowed(name) : true;
		});

	// Order: keyboard · standard (minus undo/redo) · color · highlight · [image] · table · undo · redo.
	return [
		...(hideKeyboardCloseButton ? [] : [keyboardItem]),
		...standardItems.filter((it) => !isUndoRedo(it)),
		...(allowed("textColor") ? [textColorItem] : []),
		...(allowed("highlight") ? [highlightItem] : []),
		...(hasImagePicker && allowed("image") ? [imageItem] : []),
		...(allowed("table") ? [tableItem] : []),
		...standardItems.filter(isUndoRedo),
	];
}

export type Locale = "ru" | "en";

/** What the `locale` prop accepts: an explicit language, or "auto" to read the
 * device's own language. */
export type LocaleOption = Locale | "auto";

/** Structural table operations, keyed by the Tiptap chain command they run —
 * the key doubles as the command name, so `expr` is just `${key}()`. The array
 * below fixes the order they're listed in. */
export type TableOp =
	| "addColumnBefore"
	| "addColumnAfter"
	| "addRowBefore"
	| "addRowAfter"
	| "deleteColumn"
	| "deleteRow"
	| "deleteTable"
	| "toggleHeaderRow"
	| "toggleHeaderColumn"
	| "mergeCells"
	| "splitCell";

export const TABLE_OPS: TableOp[] = [
	"addColumnBefore",
	"addColumnAfter",
	"addRowBefore",
	"addRowAfter",
	"deleteColumn",
	"deleteRow",
	"deleteTable",
	"toggleHeaderRow",
	"toggleHeaderColumn",
	"mergeCells",
	"splitCell",
];

export interface Strings {
	/** Image-source sheet, shown by the toolbar's image button when both
	 * onRequestImage and onRequestCamera are supplied. */
	imageSourceTitle: string;
	imageSourceGallery: string;
	imageSourceCamera: string;

	/** Table-size modal (toolbar table button, cursor outside a table). */
	tableTitle: string;
	tableRows: string;
	tableColumns: string;
	tableConfirm: string;

	/** Shared by the image sheet and the table modal. */
	cancel: string;

	/** Structural-ops menu (toolbar table button, cursor inside a table). */
	tableOps: Record<TableOp, string>;

	/** Placeholder title of a Projecto share card while its data is still
	 * being fetched. Unlike everything else here this string is rendered
	 * inside the WebView bundle, so RichEditor pushes it in via injectJS
	 * (see web-editor/src/projectoLink.js). */
	projectoLinkLoading: string;
}

export const STRINGS: Record<Locale, Strings> = {
	ru: {
		imageSourceTitle: "Добавить фото",
		imageSourceGallery: "Выбрать из галереи",
		imageSourceCamera: "Снять фото",

		tableTitle: "Новая таблица",
		tableRows: "Строк",
		tableColumns: "Столбцов",
		tableConfirm: "Добавить",

		cancel: "Отмена",

		tableOps: {
			addColumnBefore: "Добавить столбец слева",
			addColumnAfter: "Добавить столбец справа",
			addRowBefore: "Добавить строку выше",
			addRowAfter: "Добавить строку ниже",
			deleteColumn: "Удалить столбец",
			deleteRow: "Удалить строку",
			deleteTable: "Удалить таблицу",
			toggleHeaderRow: "Строка заголовков",
			toggleHeaderColumn: "Столбец заголовков",
			mergeCells: "Объединить ячейки",
			splitCell: "Разделить ячейку",
		},

		projectoLinkLoading: "Загрузка…",
	},
	en: {
		imageSourceTitle: "Add photo",
		// Apple's own wording for the same choice, and understood on Android
		// too — "library" rather than a platform-specific "gallery"/"photos".
		imageSourceGallery: "Choose from library",
		imageSourceCamera: "Take photo",

		tableTitle: "New table",
		tableRows: "Rows",
		tableColumns: "Columns",
		tableConfirm: "Insert",

		cancel: "Cancel",

		tableOps: {
			addColumnBefore: "Insert column left",
			addColumnAfter: "Insert column right",
			addRowBefore: "Insert row above",
			addRowAfter: "Insert row below",
			deleteColumn: "Delete column",
			deleteRow: "Delete row",
			deleteTable: "Delete table",
			toggleHeaderRow: "Toggle header row",
			toggleHeaderColumn: "Toggle header column",
			mergeCells: "Merge cells",
			splitCell: "Split cell",
		},

		projectoLinkLoading: "Loading…",
	},
};

// Resolves the `locale` prop to a concrete dictionary language. "auto" reads
// the device language via Intl (Hermes ships it, but it's guarded anyway —
// a runtime without Intl falls back rather than throwing), treating anything
// non-Russian as English.
export function resolveLocale(option: LocaleOption = "ru"): Locale {
	if (option !== "auto") return option;
	try {
		const tag = Intl.DateTimeFormat().resolvedOptions().locale;
		return tag.toLowerCase().startsWith("ru") ? "ru" : "en";
	} catch (_e) {
		return "ru";
	}
}

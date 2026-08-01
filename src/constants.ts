export const TEXT_COLORS: (string | null)[] = [
	null,
	"#202124",
	"#5f6368",
	"#c0392b",
	"#c2410c",
	"#2e7d32",
	"#1565c0",
	"#6d28d9",
];
export const HIGHLIGHT_COLORS: (string | null)[] = [
	null,
	"#ffe066",
	"#b6e3b6",
	"#acd5f2",
	"#f6b8cd",
	"#ffd9a0",
	"#d9c2f0",
	"#d9dce0",
];

export interface StructuralItem {
	label: string;
	expr: string;
}

export const STRUCTURAL_ITEMS: StructuralItem[] = [
	{ label: "Добавить колонку слева", expr: "addColumnBefore()" },
	{ label: "Добавить колонку справа", expr: "addColumnAfter()" },
	{ label: "Добавить строку выше", expr: "addRowBefore()" },
	{ label: "Добавить строку ниже", expr: "addRowAfter()" },
	{ label: "Удалить колонку", expr: "deleteColumn()" },
	{ label: "Удалить строку", expr: "deleteRow()" },
	{ label: "Удалить таблицу", expr: "deleteTable()" },
	{ label: "Верхний колонтитул строки", expr: "toggleHeaderRow()" },
	{ label: "Верхний колонтитул колонки", expr: "toggleHeaderColumn()" },
	{ label: "Объединить ячейки", expr: "mergeCells()" },
	{ label: "Разделить ячейку", expr: "splitCell()" },
];

// Labels for the image-source sheet shown by the toolbar's image button when
// the host app supplies both onRequestImage and onRequestCamera.
export const IMAGE_SOURCE_LABELS = {
	title: "Добавить фото",
	gallery: "Выбрать из галереи",
	camera: "Снять фото",
	cancel: "Отмена",
};

// Injected into the WebView so inserted images render at a sane size.
export const IMAGE_CSS = `
  img {
    max-width: 100%;
    max-height: 300px;
    width: auto;
    height: auto;
    border-radius: 8px;
    margin: 10px 0;
    display: block;
    object-fit: contain;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  img:hover {
    transform: scale(1.02);
    transition: transform 0.2s ease;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    img {
      max-height: 200px;
    }
  }
`;

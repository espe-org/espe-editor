import {
	RichText,
	Toolbar as TenTapToolbar,
	darkEditorCss,
	darkEditorTheme,
	useEditorBridge,
} from "@10play/tentap-editor";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { Keyboard, Linking, Platform, StyleSheet, View } from "react-native";
import type { KeyboardEventName } from "react-native";
import { ColorBar } from "./ColorBar";
import { HIGHLIGHT_COLORS, IMAGE_CSS, TEXT_COLORS } from "./constants";
import { editorHtml } from "./generated/editorHtml";
import { STRINGS, resolveLocale } from "./i18n";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { askImageSource } from "./imageSourceSheet";
import { buildPatchProjectoLinkScript, resolveProjectoLink } from "./projectoLinkResolver";
import { TableMenu } from "./TableMenu";
import { TableSizeModal } from "./TableSizeModal";
import { useToolbarItems } from "./Toolbar";
import type { RichEditorProps, RichEditorRef } from "./types";

const ONCHANGE_DEBOUNCE_MS = 300;

export const RichEditor = forwardRef<RichEditorRef, RichEditorProps>(
	(
		{
			initialContent,
			onChangeHTML,
			value,
			placeholder,
			autofocus = true,
			editable = true,
			onRequestImage,
			onRequestCamera,
			onImagePress,
			onProjectoLinkPress,
			textColors = TEXT_COLORS,
			highlightColors = HIGHLIGHT_COLORS,
			dynamicHeight = false,
			onContentHeightChange,
			toolbarPosition = "floating",
			toolbarActions,
			onFocus,
			onBlur,
			onLinkPress,
			colorScheme = "light",
			locale = "ru",
			style,
			hideKeyboardCloseButton = false,
		},
		ref,
	) => {
		const strings = useMemo(() => STRINGS[resolveLocale(locale)], [locale]);

		const [colorMenu, setColorMenu] = useState<"text" | "highlight" | null>(null);
		const [tableMenuVisible, setTableMenuVisible] = useState(false);
		const [tableSizeModalVisible, setTableSizeModalVisible] = useState(false);
		const [previewImage, setPreviewImage] = useState<string | null>(null);
		const [keyboardOverlap, setKeyboardOverlap] = useState(0);
		const containerRef = useRef<View>(null);

		// tentap's own internal `editorHeight` state (applied to the WebView's
		// containerStyle) can get reset back to 0 on iOS: RichText.tsx remounts
		// the WebView once shortly after first load (a workaround for
		// react-native-webview#3578), which races with the first real
		// document-height message and can drop it. So RichEditor owns the
		// height itself from the same message, mirroring how Quill.tsx sizes
		// its own wrapping View from onDimensionsChange.
		const [contentHeight, setContentHeight] = useState(0);

		// Tracks the actual measured overlap between this container's bottom
		// edge and the keyboard's top edge (both in absolute window coordinates
		// via measureInWindow), rather than the keyboard's raw height — raw
		// height assumes this container's own "bottom: 0" coincides with the
		// true screen bottom, which isn't true when a consuming app wraps
		// RichEditor in a SafeAreaView/inset. Applied as the floating toolbar's
		// `bottom` offset, or as `paddingBottom` on the whole container for a
		// docked ("top"/"bottom") toolbar so the editor area (and, for "bottom",
		// the toolbar sitting right after it) shrinks to stay clear of the
		// keyboard. Meaningless in embeddable (dynamicHeight) mode — the box
		// doesn't fill the screen there, so "overlap with the keyboard" isn't a
		// coherent idea; the consuming screen owns scrolling/positioning instead.
		useEffect(() => {
			if (dynamicHeight) return undefined;
			const hideEvent: KeyboardEventName =
				Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
			const didShow = Keyboard.addListener("keyboardDidShow", (e) => {
				containerRef.current?.measureInWindow((_x, y, _width, height) => {
					const containerBottomY = y + height;
					const keyboardTopY = e.endCoordinates.screenY;
					setKeyboardOverlap(Math.max(containerBottomY - keyboardTopY, 0));
				});
			});
			const hide = Keyboard.addListener(hideEvent, () => setKeyboardOverlap(0));
			return () => {
				didShow.remove();
				hide.remove();
			};
		}, [dynamicHeight]);

		// Guards the `value` effect below against feedback loops: setContent()
		// calls made in response to `value` must not be mistaken for user edits.
		const lastEmittedRef = useRef<string | null>(null);
		const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

		const editor = useEditorBridge({
			customSource: editorHtml,
			autofocus,
			avoidIosKeyboard: true,
			editable,
			initialContent,
			dynamicHeight,
			theme: colorScheme === "dark" ? darkEditorTheme : undefined,
			onChange: () => {
				if (!onChangeHTML) return;
				if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
				changeTimerRef.current = setTimeout(async () => {
					const html = await editor.getHTML();
					lastEmittedRef.current = html;
					onChangeHTML(html);
				}, ONCHANGE_DEBOUNCE_MS);
			},
		});

		useEffect(() => {
			return () => {
				if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
			};
		}, []);

		// Lightly-controlled mode: only push `value` down when it didn't
		// originate from this component's own onChangeHTML emission.
		useEffect(() => {
			if (value === undefined) return;
			if (value === lastEmittedRef.current) return;
			editor.setContent(value);
			lastEmittedRef.current = value;
		}, [value, editor]);

		const runCommand = (expr: string) => {
			editor.injectJS(
				`window.__editor && window.__editor.chain().focus().${expr}.run(); true;`,
			);
		};

		const handleRequestImage = async () => {
			if (!onRequestImage) return;
			const uri = await onRequestImage();
			if (uri) editor.setImage(uri);
		};

		const handleRequestCamera = async () => {
			if (!onRequestCamera) return;
			const uri = await onRequestCamera();
			if (uri) editor.setImage(uri);
		};

		// With both sources wired up the toolbar button first asks which one to
		// use via the platform's system chooser; with only one it goes straight
		// there, since a one-item sheet reads badly (same reasoning as the
		// table button's insert-vs-menu split).
		const handleImageButtonPress = async () => {
			if (!onRequestImage) return handleRequestCamera();
			if (!onRequestCamera) return handleRequestImage();

			const source = await askImageSource(strings, colorScheme);
			if (source === "gallery") await handleRequestImage();
			else if (source === "camera") await handleRequestCamera();
		};

		const toolbarItems = useToolbarItems({
			editor,
			runCommand,
			hasImagePicker: !!onRequestImage || !!onRequestCamera,
			onImagePress: handleImageButtonPress,
			onTextColorPress: () => setColorMenu("text"),
			onHighlightPress: () => setColorMenu("highlight"),
			onOpenTableMenu: () => setTableMenuVisible(true),
			onOpenTableSizeModal: () => setTableSizeModalVisible(true),
			actions: toolbarActions,
			hideKeyboardCloseButton,
		});

		useImperativeHandle(
			ref,
			() => ({
				getHTML: () => editor.getHTML(),
				setContent: (html: string) => editor.setContent(html),
				focus: (pos) => editor.focus(pos),
				blur: () => editor.blur(),
				runCommand,
			}),
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[editor],
		);

		useEffect(() => {
			editor.injectCSS(IMAGE_CSS, "image-styles");
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor]);

		// The Projecto card's loading placeholder is the one localized string
		// rendered inside the WebView rather than by React Native, so the
		// resolved dictionary is pushed in as a global that
		// web-editor/src/projectoLink.js reads when it builds a card. Cards are
		// only ever built in response to user input, long after this runs.
		useEffect(() => {
			editor.injectJS(
				`window.__espeStrings = ${JSON.stringify({
					projectoLinkLoading: strings.projectoLinkLoading,
				})}; true;`,
			);
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor, strings]);

		useEffect(() => {
			if (placeholder !== undefined) editor.setPlaceholder(placeholder);
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor, placeholder]);

		// theme (above) only covers the toolbar/webview background; darkEditorCss
		// is the document/prose color rules. injectCSS replaces by tag, so
		// switching back to "light" with an empty string clears it.
		useEffect(() => {
			editor.injectCSS(colorScheme === "dark" ? darkEditorCss : "", "color-scheme");
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor, colorScheme]);

		// Uses the bridge's own low-level state subscription rather than
		// useBridgeState, which would re-render RichEditor on every keystroke/
		// selection change just to watch one boolean.
		useEffect(() => {
			if (!onFocus && !onBlur) return undefined;
			let wasFocused = false;
			return editor._subscribeToEditorStateUpdate((state) => {
				const isFocused = !!(state as { isFocused?: boolean }).isFocused;
				if (isFocused === wasFocused) return;
				wasFocused = isFocused;
				(isFocused ? onFocus : onBlur)?.();
			});
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor, onFocus, onBlur]);

		if (!editor) return null;

		const renderToolbar = (docked: boolean) => (
			<View style={[styles.toolbarStack, docked && toolbarActions?.length ? styles.toolbarStackDocked : null]}>
				{toolbarActions?.length ? <TenTapToolbar editor={editor} items={toolbarItems} hidden={docked ? false : undefined} /> : null}
				{colorMenu ? (
					<View style={styles.colorBarOverlay}>
						<ColorBar
							colors={colorMenu === "text" ? textColors : highlightColors}
							onClose={() => setColorMenu(null)}
							onPick={(c) => {
								const mode = colorMenu;
								setColorMenu(null);
								if (mode === "text") {
									if (c) editor.setColor(c);
									else editor.unsetColor();
								} else {
									if (c) editor.setHighlight(c);
									else editor.unsetHighlight();
								}
							}}
						/>
					</View>
				) : null}
			</View>
		);

		return (
			<View
				ref={containerRef}
				style={[
					dynamicHeight ? styles.containerAuto : styles.container,
					!dynamicHeight && toolbarPosition !== "floating"
						? { paddingBottom: keyboardOverlap }
						: null,
					style,
				]}
			>
				{toolbarPosition === "top" ? renderToolbar(true) : null}

				<View
					style={[
						dynamicHeight ? styles.editorWrapperAuto : styles.editorWrapper,
						dynamicHeight ? { height: contentHeight } : null,
					]}
				>
					<RichText
						editor={editor}
						exclusivelyUseCustomOnMessage={false}
						// Overrides tentap's own internal containerStyle (which tracks
						// its own, separately-reset `editorHeight` state — see the
						// contentHeight comment above) with the height this component
						// tracks itself. theme.webviewContainer is `{}` on both tentap
						// themes, so nothing is lost by fully replacing it here.
						containerStyle={dynamicHeight ? { height: contentHeight } : undefined}
						onMessage={(event) => {
							const data = event?.nativeEvent?.data;
							if (typeof data !== "string") return;
							try {
								// Posted by web-editor/src/imageLongPress.js on a
								// long-press of an image.
								if (data.indexOf("imagePreview") !== -1) {
									const msg = JSON.parse(data);
									if (msg.type === "imagePreview" && msg.payload?.src) {
										if (onImagePress) onImagePress(msg.payload.src);
										else setPreviewImage(msg.payload.src);
									}
									return;
								}

								// Posted by web-editor/src/projectoLink.js when a
								// freshly-inserted card needs its data fetched.
								// The fetch happens here (native), not in the
								// WebView, since the share page sends no CORS
								// headers and RN's fetch isn't subject to them.
								if (data.indexOf("projectoLinkResolve") !== -1) {
									const msg = JSON.parse(data);
									if (msg.type === "projectoLinkResolve" && msg.payload?.id && msg.payload?.url) {
										const { id, url } = msg.payload;
										resolveProjectoLink(url).then((result) => {
											const patch = result
												? {
														status: "ready",
														title: result.title,
														icon: result.icon,
														description: result.description,
														taskUrl: result.taskUrl,
													}
												: { status: "error" };
											editor.injectJS(buildPatchProjectoLinkScript(id, patch));
										});
									}
									return;
								}

								// Posted by web-editor/src/projectoLink.js when a
								// resolved card is tapped.
								if (data.indexOf("projectoLinkPress") !== -1) {
									const msg = JSON.parse(data);
									if (msg.type === "projectoLinkPress" && msg.payload?.taskUrl) {
										if (onProjectoLinkPress) onProjectoLinkPress(msg.payload.taskUrl);
										else Linking.openURL(msg.payload.taskUrl).catch(() => {});
									}
									return;
								}

								// Posted by web-editor/src/linkClick.js on tapping any
								// hyperlink in the content.
								if (data.indexOf("linkPress") !== -1) {
									const msg = JSON.parse(data);
									if (msg.type === "linkPress" && msg.payload?.href) {
										if (onLinkPress) onLinkPress(msg.payload.href);
										else Linking.openURL(msg.payload.href).catch(() => {});
									}
									return;
								}

								// Posted by tentap itself when dynamicHeight is enabled.
								if (data.indexOf("document-height") !== -1) {
									const msg = JSON.parse(data);
									if (msg.type === "document-height" && typeof msg.payload === "number") {
										setContentHeight(msg.payload);
										onContentHeightChange?.(msg.payload);
									}
								}
							} catch (_e) {
								// ignore non-JSON messages
							}
						}}
					/>
				</View>

				{toolbarPosition === "bottom" ? renderToolbar(true) : null}

				{toolbarPosition === "floating" ? (
					<View style={[styles.toolbarContainer, { bottom: keyboardOverlap }]}>
						{renderToolbar(false)}
					</View>
				) : null}

				{!onImagePress ? (
					<ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />
				) : null}

				<TableMenu
					visible={tableMenuVisible}
					onClose={() => setTableMenuVisible(false)}
					onRunCommand={runCommand}
					strings={strings}
				/>

				<TableSizeModal
					visible={tableSizeModalVisible}
					strings={strings}
					onClose={() => setTableSizeModalVisible(false)}
					onConfirm={(rows, columns) => {
						setTableSizeModalVisible(false);
						runCommand(`insertTable({ rows: ${rows}, cols: ${columns}, withHeaderRow: true })`);
					}}
				/>
			</View>
		);
	},
);

RichEditor.displayName = "RichEditor";

export default RichEditor;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	// Used when dynamicHeight is true: the box sizes to its content (the
	// WebView applies its own height internally), not stretched by flex.
	containerAuto: {
		backgroundColor: "#fff",
	},
	editorWrapper: {
		flex: 1,
		backgroundColor: "#fff",
		// No right inset: the WebView spans to the screen edge so its
		// scrollbar sits at the edge (not floating over the drag-handle
		// gutter). The text inset lives inside the bundle (.ProseMirror
		// padding), not here.
		paddingLeft: 2,
		paddingRight: 0,
	},
	editorWrapperAuto: {
		backgroundColor: "#fff",
		paddingLeft: 2,
		paddingRight: 0,
	},
	// Matches tentap's own theme.toolbar.keyboardAvoidingView: the toolbar's
	// FlatList has both flex:1 and an explicit height (see toolbarTheme.ts),
	// which only resolves to its intended fixed height when absolutely
	// positioned — nesting it in normal flex flow collapses it to ~0. Only
	// used for toolbarPosition "floating"; "top"/"bottom" render the same
	// toolbarStack in normal flow instead.
	toolbarContainer: {
		position: "absolute",
		width: "100%",
		// `bottom` is set inline from tracked keyboard height.
	},
	toolbarStack: {
		position: "relative",
	},
	// Docked ("top"/"bottom") toolbars render in normal flex flow, not
	// position:absolute — so, same as the floating case, the toolbar's own
	// FlatList (flex:1 + explicit height, see toolbarTheme.ts) needs an
	// unambiguous height to resolve against, or Yoga collapses it to ~0
	// trying to reconcile flex:1 against an otherwise auto-sized parent.
	toolbarStackDocked: {
		height: 44,
	},
	colorBarOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
});

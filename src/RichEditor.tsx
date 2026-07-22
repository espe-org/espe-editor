import {
	RichText,
	Toolbar as TenTapToolbar,
	useEditorBridge,
} from "@10play/tentap-editor";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { Keyboard, Linking, Platform, StyleSheet, View } from "react-native";
import type { KeyboardEventName } from "react-native";
import { ColorBar } from "./ColorBar";
import { HIGHLIGHT_COLORS, IMAGE_CSS, TEXT_COLORS } from "./constants";
import { editorHtml } from "./generated/editorHtml";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { buildPatchProjectoLinkScript, resolveProjectoLink } from "./projectoLinkResolver";
import { TableMenu } from "./TableMenu";
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
			onImagePress,
			onProjectoLinkPress,
			textColors = TEXT_COLORS,
			highlightColors = HIGHLIGHT_COLORS,
			style,
		},
		ref,
	) => {
		const [colorMenu, setColorMenu] = useState<"text" | "highlight" | null>(null);
		const [tableMenuVisible, setTableMenuVisible] = useState(false);
		const [previewImage, setPreviewImage] = useState<string | null>(null);
		const [toolbarBottomOffset, setToolbarBottomOffset] = useState(0);
		const containerRef = useRef<View>(null);

		// Drives the toolbar's `bottom` offset from the actual measured overlap
		// between this container's bottom edge and the keyboard's top edge (both
		// in absolute window coordinates via measureInWindow), rather than the
		// keyboard's raw height. Using raw height assumes this container's own
		// "bottom: 0" coincides with the true screen bottom, which isn't true
		// when a consuming app wraps RichEditor in a SafeAreaView/inset — that
		// mismatch is exactly what left a stray gap above the toolbar. Measuring
		// both edges directly is correct regardless of any such nesting, with no
		// extra setup required from the consuming app.
		useEffect(() => {
			const hideEvent: KeyboardEventName =
				Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
			const didShow = Keyboard.addListener("keyboardDidShow", (e) => {
				containerRef.current?.measureInWindow((_x, y, _width, height) => {
					const containerBottomY = y + height;
					const keyboardTopY = e.endCoordinates.screenY;
					setToolbarBottomOffset(Math.max(containerBottomY - keyboardTopY, 0));
				});
			});
			const hide = Keyboard.addListener(hideEvent, () => setToolbarBottomOffset(0));
			return () => {
				didShow.remove();
				hide.remove();
			};
		}, []);

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

		const toolbarItems = useToolbarItems({
			editor,
			runCommand,
			hasImagePicker: !!onRequestImage,
			onImagePress: handleRequestImage,
			onTextColorPress: () => setColorMenu("text"),
			onHighlightPress: () => setColorMenu("highlight"),
			onOpenTableMenu: () => setTableMenuVisible(true),
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

		useEffect(() => {
			if (placeholder !== undefined) editor.setPlaceholder(placeholder);
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor, placeholder]);

		if (!editor) return null;

		return (
			<View ref={containerRef} style={[styles.container, style]}>
				<View style={styles.editorWrapper}>
					<RichText
							editor={editor}
							exclusivelyUseCustomOnMessage={false}
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
									}
								} catch (_e) {
									// ignore non-JSON messages
								}
							}}
						/>
					</View>

				<View style={[styles.toolbarContainer, { bottom: toolbarBottomOffset }]}>
					<View style={styles.toolbarStack}>
						<TenTapToolbar editor={editor} items={toolbarItems} />
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
				</View>

				{!onImagePress ? (
					<ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />
				) : null}

				<TableMenu
					visible={tableMenuVisible}
					onClose={() => setTableMenuVisible(false)}
					onRunCommand={runCommand}
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
	// Matches tentap's own theme.toolbar.keyboardAvoidingView: the toolbar's
	// FlatList has both flex:1 and an explicit height (see toolbarTheme.ts),
	// which only resolves to its intended fixed height when absolutely
	// positioned — nesting it in normal flex flow collapses it to ~0.
	toolbarContainer: {
		position: "absolute",
		width: "100%",
		// `bottom` is set inline from tracked keyboard height.
	},
	toolbarStack: {
		position: "relative",
	},
	colorBarOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
});

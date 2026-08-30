import {
	RichText,
	TenTapStartKit,
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
			firstLineStyle,
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
		//
		// Последний кадр клавиатуры. Живёт в ref, а не в замыкании эффекта,
		// потому что пересчитывать перекрытие приходится и вне событий
		// клавиатуры — см. recomputeKeyboardOverlap.
		const keyboardFrameRef = useRef<{ screenY: number; height: number } | null>(
			null,
		);

		// Меряет контейнер и переводит кадр клавиатуры в перекрытие.
		//
		// Вызывается и по событию клавиатуры, и по onLayout контейнера. Одного
		// события мало: хост, который сам уводит контент от клавиатуры (скажем,
		// оборачивает нас в KeyboardAvoidingView), накладывает свой паддинг не
		// мгновенно. При возврате приложения из фона measureInWindow успевает
		// отработать раньше — контейнер ещё во всю высоту, и мы вычитаем
		// клавиатуру вторым слоем поверх хостового. Замерено на iPhone Air:
		// в покое height=439, overlap=0; сразу после возврата height=786,
		// overlap=275. Эти 275pt пустоты над клавиатурой держались до следующего
		// события клавиатуры, то есть до первого действия пользователя.
		//
		// Зацикливания нет: собственный paddingBottom не меняет внешний фрейм,
		// который читает measureInWindow, поэтому сам себя onLayout не вызывает.
		const recomputeKeyboardOverlap = () => {
			const frame = keyboardFrameRef.current;

			if (!frame) {
				setKeyboardOverlap(0);
				return;
			}

			containerRef.current?.measureInWindow((_x, y, _width, height) => {
				const containerBottomY = y + height;
				// Перекрытие не бывает больше самой клавиатуры: всё сверх её
				// высоты — либо чужой паддинг, уже наложенный хостом, либо замер,
				// снятый не вовремя.
				setKeyboardOverlap(
					Math.min(Math.max(containerBottomY - frame.screenY, 0), frame.height),
				);
			});
		};

		useEffect(() => {
			if (dynamicHeight) return undefined;
			const hideEvent: KeyboardEventName =
				Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
			const didShow = Keyboard.addListener("keyboardDidShow", (e) => {
				// Уходя в фон, iOS присылает keyboardDidShow с пустым кадром:
				// screenY и height по нулям. Принятый всерьёз, он давал перекрытие
				// во всю высоту контейнера — весь редактор уходил под паддинг.
				// Такой кадр не описывает ничего, пропускаем.
				if (!e.endCoordinates.height || !e.endCoordinates.screenY) {
					return;
				}

				keyboardFrameRef.current = {
					height: e.endCoordinates.height,
					screenY: e.endCoordinates.screenY,
				};
				recomputeKeyboardOverlap();
			});
			const hide = Keyboard.addListener(hideEvent, () => {
				keyboardFrameRef.current = null;
				setKeyboardOverlap(0);
			});
			return () => {
				didShow.remove();
				hide.remove();
			};
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [dynamicHeight]);

		// Guards the `value` effect below against feedback loops: setContent()
		// calls made in response to `value` must not be mistaken for user edits.
		const lastEmittedRef = useRef<string | null>(null);
		const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

		// Content and placeholder that arrived before the WebView was able to
		// receive them.
		//
		// tentap's bridge does not buffer: sendAction() logs "Editor isn't ready
		// yet" and returns when webviewRef is empty, and even once the ref is
		// set, postMessage() into a document that hasn't finished loading is
		// dropped. So a setContent() issued while the editor is still booting is
		// lost silently. That is easy to hit — the WebView carries the whole
		// editor bundle, so hosts that mount RichEditor early (to overlap its
		// boot with their own data loading) will usually have their content
		// ready first.
		//
		// The placeholder no longer goes through here at all — see
		// bridgeExtensions below, it is configured before the WebView loads.
		//
		// Readiness is tracked from tentap's own editor-ready message rather
		// than from editor state: `isReady` only reaches the state via a
		// StateUpdate, which the WebView emits on editor activity alone, and a
		// note the user merely opens may never produce any.
		const isReadyRef = useRef(false);
		const pendingContentRef = useRef<string | null>(null);
		const pendingPlaceholderRef = useRef<string | null>(null);

		// The placeholder goes in as the extension's own option, baked into the
		// bridge config map that is injected before the WebView loads, so the
		// right text is on screen from the first frame.
		//
		// The alternative — the runtime `set-placeholder` bridge message — does
		// not work at all under tiptap v3. That handler assigns to
		// `extensionManager.extensions[i].options.placeholder`, and in v3 an
		// extension's `options` is derived, not a writable bag: the assignment
		// is silently dropped (verified on device — the message arrives, the
		// option reads back unchanged), leaving tiptap's English default.
		const bridgeExtensions = useMemo(
			() =>
				placeholder === undefined
					? TenTapStartKit
					: TenTapStartKit.map((bridge) =>
							bridge.name === "placeholder"
								? bridge.configureExtension({ placeholder })
								: bridge,
						),
			[placeholder],
		);

		const editor = useEditorBridge({
			bridgeExtensions,
			customSource: editorHtml,
			autofocus,
			// Exactly the cases this component does NOT handle itself — the
			// inverse of the keyboardOverlap padding below.
			//
			// tentap's avoidance assumes the WebView keeps its full height *behind*
			// the keyboard: on iOS it gives the document a paddingBottom of the
			// keyboard height and sets the same value as the scroll margin, so the
			// caret is never left under the keys. With a docked toolbar this
			// component does the opposite — the box itself shrinks above the
			// keyboard — and the two compose into nonsense: a scroll margin worth a
			// whole keyboard, applied to a viewport barely taller than one, pushes
			// the caret line to the top edge and leaves the rest of the editor
			// blank on every keystroke.
			//
			// Left on for a floating toolbar, where the box does stay full height
			// and tentap's inset is the only thing keeping the caret visible. Off
			// in embeddable mode: there the document height drives the box height,
			// so a keyboard-sized padding would inflate the layout, and the
			// consuming screen owns scrolling anyway.
			avoidIosKeyboard: !dynamicHeight && toolbarPosition === "floating",
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

		// tentap themes the WebView itself; these are the React Native boxes
		// around it, and they have to follow the same scheme. Otherwise the
		// light default stays put in dark mode and shows through everywhere the
		// WebView doesn't reach — most visibly as a pale strip down the left,
		// where editorWrapper's 2px inset sits. Taken from tentap's own theme
		// rather than hardcoded, so the two cannot drift apart.
		const surfaceColor =
			colorScheme === "dark"
				? ((darkEditorTheme.webview as { backgroundColor?: string } | undefined)
						?.backgroundColor ?? "#1C1C1E")
				: "#fff";

		// Доводит вид до каретки, ничего больше не трогая.
		//
		// Отдельно от runCommand: тот открывает цепочку с .focus(), то есть
		// поднимает клавиатуру. Здесь нужен только скролл — вызывающая сторона
		// сама решает, фокусироваться ли.
		//
		// Двойной requestAnimationFrame, а не голый вызов: скролл почти всегда
		// идёт следом за тем, что саму каретку и двигает — setContent или
		// focus. Те приходят отдельными сообщениями моста, и на момент
		// доставки этого документ ещё не перерисован: проверено на устройстве,
		// прямой вызов после setContent не сдвигал вид вообще. Первый кадр
		// пропускает применение изменений, второй — раскладку после них.
		const scrollToCursor = () => {
			editor.injectJS(
				`window.__editor && requestAnimationFrame(() =>
					requestAnimationFrame(() =>
						window.__editor.commands.scrollIntoView(),
					),
				); true;`,
			);
		};

		// Переносит автофокус на текст, который пришёл уже после старта.
		//
		// tentap применяет autofocus при создании редактора, а документ в этот
		// момент пуст: у хоста, который монтирует редактор заранее и подаёт
		// текст позже (ровно то, ради чего и сделан pendingContent), каретка
		// остаётся в конце пустого документа, а после подстановки оказывается
		// неизвестно где. На длинной заметке это выглядело так: клавиатура
		// поднята, каретка в конце текста, а видимая область где-то в
		// середине — и первый же ввод шёл за пределами экрана.
		//
		// Только на первую порцию текста: последующие setContent — это уже не
		// открытие, и уводить у пользователя каретку там нельзя.
		const autofocusAppliedRef = useRef(false);

		// Одной инъекцией, а не editor.focus("end") + scrollToCursor: те идут
		// отдельными сообщениями моста и доставляются раньше, чем ProseMirror
		// применит новый документ, поэтому "end" разрешался по старому —
		// пустому — тексту. Проверено на устройстве: вид не сдвигался вовсе.
		// Внутри WebView оба шага выполняются уже после применения и раскладки.
		const applyAutofocusToContent = () => {
			if (!autofocus || autofocusAppliedRef.current) return;
			autofocusAppliedRef.current = true;
			editor.injectJS(
				`window.__editor && requestAnimationFrame(() =>
					requestAnimationFrame(() =>
						window.__editor.chain().focus('end').scrollIntoView().run(),
					),
				); true;`,
			);
		};

		// Same contract as editor.setContent(), minus the silent loss: content
		// handed over too early is held and applied as soon as the editor is up.
		const setContentWhenReady = (html: string) => {
			if (!isReadyRef.current) {
				pendingContentRef.current = html;
				return;
			}
			editor.setContent(html);
			applyAutofocusToContent();
		};

		// Best effort for a `placeholder` prop that changes after mount: the
		// config map is injected once, before the WebView loads, so a later
		// value can only travel as a bridge message. That message is a no-op
		// under tiptap v3 (see bridgeExtensions above); it is kept because it
		// is the only channel that exists for this case, and it costs nothing
		// if tentap makes the handler v3-aware.
		const setPlaceholderWhenReady = (text: string) => {
			if (!isReadyRef.current) {
				pendingPlaceholderRef.current = text;
				return;
			}
			editor.setPlaceholder(text);
		};

		// Called when the WebView reports the editor is up (see onMessage).
		// Nothing the user typed can be overwritten here: the editor could not
		// accept input before it was ready.
		const flushPending = () => {
			isReadyRef.current = true;

			if (pendingPlaceholderRef.current !== null) {
				const text = pendingPlaceholderRef.current;
				pendingPlaceholderRef.current = null;
				editor.setPlaceholder(text);
			}

			if (pendingContentRef.current === null) return;
			const html = pendingContentRef.current;
			pendingContentRef.current = null;
			editor.setContent(html);
			// Сюда попадает самый частый случай открытия: текст пришёл раньше,
			// чем редактор поднялся, и ждал во флаге.
			applyAutofocusToContent();
		};

		// Lightly-controlled mode: only push `value` down when it didn't
		// originate from this component's own onChangeHTML emission.
		useEffect(() => {
			if (value === undefined) return;
			if (value === lastEmittedRef.current) return;
			setContentWhenReady(value);
			lastEmittedRef.current = value;
			// eslint-disable-next-line react-hooks/exhaustive-deps
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
				setContent: (html: string) => setContentWhenReady(html),
				// Фокус без скролла оставлял каретку за пределами экрана на
				// любом тексте длиннее одного экрана — заметнее всего на
				// focus('end'). Оба сообщения идут одним мостом по порядку,
				// поэтому скролл приходит уже с новой позицией каретки.
				focus: (pos) => {
					editor.focus(pos);
					scrollToCursor();
				},
				blur: () => editor.blur(),
				runCommand,
				scrollToCursor,
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
			if (placeholder !== undefined) setPlaceholderWhenReady(placeholder);
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor, placeholder]);

		// theme (above) only covers the toolbar/webview background; darkEditorCss
		// is the document/prose color rules. injectCSS replaces by tag, so
		// switching back to "light" with an empty string clears it.
		useEffect(() => {
			editor.injectCSS(colorScheme === "dark" ? darkEditorCss : "", "color-scheme");
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor, colorScheme]);

		// Built from the primitives rather than the object so that a caller
		// passing an inline literal doesn't re-inject the stylesheet on every
		// render.
		const firstLineCss = useMemo(() => {
			const rules = [
				firstLineStyle?.fontSize !== undefined
					? `font-size: ${firstLineStyle.fontSize}px;`
					: null,
				firstLineStyle?.fontWeight !== undefined
					? `font-weight: ${firstLineStyle.fontWeight};`
					: null,
			].filter(Boolean);

			if (!rules.length) return "";

			// `:first-child` counts as a class for specificity, so this outranks
			// the bundle's own `.ProseMirror p` block rules without !important.
			// Direct-child only: nested first items (a list's first <li>, a
			// table's first cell) are not the document's opening block.
			return `.ProseMirror > :first-child { ${rules.join(" ")} }`;
		}, [firstLineStyle?.fontSize, firstLineStyle?.fontWeight]);

		useEffect(() => {
			editor.injectCSS(firstLineCss, "first-line");
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [editor, firstLineCss]);

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
				// Пересчитываем перекрытие на каждой переразметке контейнера, а не
				// только по событию клавиатуры: паддинг хоста приезжает позже
				// события, и снятый до него замер оставлял лишнюю пустоту над
				// клавиатурой до первого действия пользователя.
				onLayout={dynamicHeight ? undefined : recomputeKeyboardOverlap}
				style={[
					dynamicHeight ? styles.containerAuto : styles.container,
					{ backgroundColor: surfaceColor },
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
						{ backgroundColor: surfaceColor },
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
								// Posted by tentap from the WebView editor's onCreate.
								// This is the moment the bridge starts carrying messages,
								// so anything setContent()/setPlaceholder() had to hold
								// back goes in now. tentap drives its own autofocus off
								// the same message, so this round-trip is no less reliable
								// here than it is for the library's own behaviour.
								if (data.indexOf("editor-ready") !== -1) {
									flushPending();
									return;
								}

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

// The background of these four is applied at the usage site from
// surfaceColor, since it depends on colorScheme.
const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	// Used when dynamicHeight is true: the box sizes to its content (the
	// WebView applies its own height internally), not stretched by flex.
	containerAuto: {},
	editorWrapper: {
		flex: 1,
		// No right inset: the WebView spans to the screen edge so its
		// scrollbar sits at the edge (not floating over the drag-handle
		// gutter). The text inset lives inside the bundle (.ProseMirror
		// padding), not here.
		paddingLeft: 2,
		paddingRight: 0,
	},
	editorWrapperAuto: {
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

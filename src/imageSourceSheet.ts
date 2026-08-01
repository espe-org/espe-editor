import { ActionSheetIOS, Alert, Platform } from "react-native";
import type { Strings } from "./i18n";

export type ImageSource = "gallery" | "camera";

// Asks the user where the image should come from, using the platform's own
// system UI: a real UIAlertController action sheet on iOS, and — since Android
// has no system action sheet — the system alert dialog with the same three
// choices. Resolves to null when the user cancels or dismisses it.
export function askImageSource(
	strings: Strings,
	colorScheme: "light" | "dark" = "light",
): Promise<ImageSource | null> {
	const {
		imageSourceTitle: title,
		imageSourceGallery: gallery,
		imageSourceCamera: camera,
		cancel,
	} = strings;

	if (Platform.OS === "ios") {
		return new Promise((resolve) => {
			ActionSheetIOS.showActionSheetWithOptions(
				{
					title,
					options: [gallery, camera, cancel],
					cancelButtonIndex: 2,
					userInterfaceStyle: colorScheme,
				},
				(index) => {
					if (index === 0) resolve("gallery");
					else if (index === 1) resolve("camera");
					else resolve(null);
				},
			);
		});
	}

	return new Promise((resolve) => {
		let settled = false;
		const settle = (source: ImageSource | null) => {
			if (settled) return;
			settled = true;
			resolve(source);
		};
		Alert.alert(
			title,
			undefined,
			[
				{ text: gallery, onPress: () => settle("gallery") },
				{ text: camera, onPress: () => settle("camera") },
				{ text: cancel, style: "cancel", onPress: () => settle(null) },
			],
			// onDismiss covers a tap outside the dialog / back button, which
			// fires no button handler at all.
			{ cancelable: true, onDismiss: () => settle(null) },
		);
	});
}

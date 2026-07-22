import { Image, Modal, StyleSheet, Text, TouchableOpacity } from "react-native";

interface ImagePreviewModalProps {
	src: string | null;
	onClose: () => void;
}

// Default full-screen image viewer, opened when the user long-presses an
// image inside the WebView (see web-editor/src/imageLongPress.js, which
// posts {type:"imagePreview", payload:{src}}). Override via RichEditor's
// onImagePress prop to use your own viewer instead.
export const ImagePreviewModal = ({ src, onClose }: ImagePreviewModalProps) => (
	<Modal visible={!!src} transparent animationType="fade" onRequestClose={onClose}>
		<TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
			{src ? (
				<Image source={{ uri: src }} style={styles.image} resizeMode="contain" />
			) : null}
			<TouchableOpacity style={styles.close} onPress={onClose}>
				<Text style={styles.closeText}>✕</Text>
			</TouchableOpacity>
		</TouchableOpacity>
	</Modal>
);

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.95)",
		justifyContent: "center",
		alignItems: "center",
	},
	image: {
		width: "100%",
		height: "100%",
	},
	close: {
		position: "absolute",
		top: 48,
		right: 20,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(0,0,0,0.5)",
		alignItems: "center",
		justifyContent: "center",
	},
	closeText: {
		color: "#fff",
		fontSize: 22,
		lineHeight: 24,
	},
});

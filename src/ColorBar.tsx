import { Images } from "@10play/tentap-editor";
import {
	Image,
	ScrollView,
	StyleSheet,
	TouchableOpacity,
	View,
} from "react-native";

interface ColorBarProps {
	colors: (string | null)[];
	onClose: () => void;
	onPick: (color: string | null) => void;
}

// Inline color bar that REPLACES the toolbar (rendered as an overlay over it,
// so the toolbar underneath stays mounted and the editor keeps focus) when
// picking a color — like tentap's heading sub-toolbar. The close (✕) button
// only closes the picker; tapping a swatch applies the color and closes.
export const ColorBar = ({ colors, onClose, onPick }: ColorBarProps) => (
	<View style={styles.colorBar}>
		<TouchableOpacity style={styles.colorBarBack} onPress={onClose}>
			<Image
				source={Images.close}
				style={styles.colorBarCloseIcon}
				resizeMode="contain"
			/>
		</TouchableOpacity>
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.colorBarSwatches}
		>
			{colors.map((c, i) => (
				<TouchableOpacity
					key={i}
					style={[styles.barSwatch, c ? { backgroundColor: c } : styles.swatchReset]}
					onPress={() => onPick(c)}
				/>
			))}
		</ScrollView>
	</View>
);

const styles = StyleSheet.create({
	colorBar: {
		flexDirection: "row",
		alignItems: "center",
		height: 44,
		backgroundColor: "#fff",
		borderTopWidth: 0.5,
		borderBottomWidth: 0.5,
		borderColor: "#DEE0E3",
		paddingHorizontal: 4,
	},
	colorBarBack: {
		height: 44,
		paddingHorizontal: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	colorBarCloseIcon: {
		width: 28,
		height: 28,
		tintColor: "#898989",
	},
	colorBarSwatches: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 6,
	},
	barSwatch: {
		width: 28,
		height: 28,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: "rgba(0,0,0,0.15)",
	},
	swatchReset: {
		backgroundColor: "transparent",
	},
});

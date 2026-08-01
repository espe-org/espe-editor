import {
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { TABLE_OPS, type Strings } from "./i18n";

interface TableMenuProps {
	visible: boolean;
	onClose: () => void;
	onRunCommand: (expr: string) => void;
	strings: Strings;
}

// Structural table-operations menu (add/delete row/column, merge/split cell,
// header toggles), opened by the toolbar's table button while the cursor is
// inside a table.
export const TableMenu = ({ visible, onClose, onRunCommand, strings }: TableMenuProps) => (
	<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
		<TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
			<View style={styles.menuCard} onStartShouldSetResponder={() => true}>
				<ScrollView style={styles.scroll}>
					{TABLE_OPS.map((op) => (
						<TouchableOpacity
							key={op}
							style={styles.menuItem}
							onPress={() => {
								onClose();
								onRunCommand(`${op}()`);
							}}
						>
							<Text style={styles.menuItemText}>{strings.tableOps[op]}</Text>
						</TouchableOpacity>
					))}
				</ScrollView>
			</View>
		</TouchableOpacity>
	</Modal>
);

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0,0,0,0.2)",
	},
	menuCard: {
		backgroundColor: "#fff",
		borderRadius: 10,
		minWidth: 200,
		paddingVertical: 6,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 6,
	},
	scroll: {
		maxHeight: 360,
	},
	menuItem: {
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	menuItemText: {
		fontSize: 16,
		color: "#333",
	},
});

import { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface TableSizeModalProps {
	visible: boolean;
	onClose: () => void;
	onConfirm: (rows: number, columns: number) => void;
}

const MIN = 1;
const MAX = 20;
const DEFAULT_SIZE = 3;

const Stepper = ({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (next: number) => void;
}) => (
	<View style={styles.row}>
		<Text style={styles.rowLabel}>{label}</Text>
		<TouchableOpacity
			style={styles.stepButton}
			disabled={value <= MIN}
			onPress={() => onChange(Math.max(MIN, value - 1))}
		>
			<Text style={[styles.stepButtonText, value <= MIN && styles.stepButtonTextDisabled]}>
				−
			</Text>
		</TouchableOpacity>
		<Text style={styles.value}>{value}</Text>
		<TouchableOpacity
			style={styles.stepButton}
			disabled={value >= MAX}
			onPress={() => onChange(Math.min(MAX, value + 1))}
		>
			<Text style={[styles.stepButtonText, value >= MAX && styles.stepButtonTextDisabled]}>
				+
			</Text>
		</TouchableOpacity>
	</View>
);

// Table-size picker, opened by the toolbar's table button when the cursor is
// outside a table (inside one, the structural-ops menu — TableMenu — opens
// instead).
export const TableSizeModal = ({ visible, onClose, onConfirm }: TableSizeModalProps) => {
	const [rows, setRows] = useState(DEFAULT_SIZE);
	const [columns, setColumns] = useState(DEFAULT_SIZE);

	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
				<View style={styles.card} onStartShouldSetResponder={() => true}>
					<Text style={styles.title}>Новая таблица</Text>

					<Stepper label="Строк" value={rows} onChange={setRows} />
					<Stepper label="Столбцов" value={columns} onChange={setColumns} />

					<View style={styles.actions}>
						<TouchableOpacity style={styles.actionButton} onPress={onClose}>
							<Text style={styles.cancelText}>Отмена</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.actionButton}
							onPress={() => {
								onConfirm(rows, columns);
								setRows(DEFAULT_SIZE);
								setColumns(DEFAULT_SIZE);
							}}
						>
							<Text style={styles.confirmText}>Добавить</Text>
						</TouchableOpacity>
					</View>
				</View>
			</TouchableOpacity>
		</Modal>
	);
};

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0,0,0,0.2)",
	},
	card: {
		backgroundColor: "#fff",
		borderRadius: 12,
		width: 260,
		paddingVertical: 16,
		paddingHorizontal: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 6,
	},
	title: {
		fontSize: 16,
		fontWeight: "600",
		color: "#202124",
		textAlign: "center",
		marginBottom: 16,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	rowLabel: {
		flex: 1,
		fontSize: 15,
		color: "#5f6368",
	},
	stepButton: {
		width: 28,
		height: 28,
		borderRadius: 6,
		backgroundColor: "#f0f0f0",
		alignItems: "center",
		justifyContent: "center",
	},
	stepButtonText: {
		fontSize: 18,
		lineHeight: 20,
		color: "#202124",
	},
	stepButtonTextDisabled: {
		color: "#c0c0c0",
	},
	value: {
		width: 32,
		textAlign: "center",
		fontSize: 15,
		color: "#202124",
	},
	actions: {
		flexDirection: "row",
		marginTop: 8,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "#e0e0e0",
	},
	actionButton: {
		flex: 1,
		paddingTop: 12,
		alignItems: "center",
	},
	cancelText: {
		fontSize: 15,
		color: "#5f6368",
	},
	confirmText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#0085e2",
	},
});

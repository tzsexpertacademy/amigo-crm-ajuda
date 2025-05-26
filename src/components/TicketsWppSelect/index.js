import React from "react";

import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import { Checkbox, ListItemText } from "@material-ui/core";
import { i18n } from "../../translate/i18n";

const TicketsWppSelect = ({
	userWpps,
	selectedWppIds = [],
	onChange,
}) => {
	const handleChange = e => {
		onChange(e.target.value);
	};

	return (
		<div style={{ width: 120, marginTop: -4 }}>
			<FormControl fullWidth margin="dense">
				<Select
					multiple
					displayEmpty
					variant="outlined"
					value={selectedWppIds}
					onChange={handleChange}
					MenuProps={{
						anchorOrigin: {
							vertical: "bottom",
							horizontal: "left",
						},
						transformOrigin: {
							vertical: "top",
							horizontal: "left",
						},
						getContentAnchorEl: null,
					}}
					renderValue={() => i18n.t("ticketsWppSelect.placeholder")}
				>
					{userWpps?.length > 0 &&
						userWpps.map(wpp => (
							<MenuItem dense key={wpp.id} value={wpp.id}>
								<Checkbox
									// style={{
									// 	color: wpp.color,
									// }}
									size="small"
									color="primary"
									checked={selectedWppIds.indexOf(wpp.id) > -1}
								/>
								<ListItemText primary={wpp.name} />
							</MenuItem>
						))}
				</Select>
			</FormControl>
		</div>
	);
};

export default TicketsWppSelect;

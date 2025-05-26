import React, { useEffect, useState } from "react";
import { Field } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import Typography from "@material-ui/core/Typography";
import axios from "axios";

const useStyles = makeStyles(theme => ({
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
}));

const AssistentSelectSingle = ({ api_key }) => {
    const classes = useStyles();
    const [queues, setQueues] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get("https://api.openai.com/v1/assistants", {
                    headers: {
                        'authorization': `Bearer ${api_key}`,
                        'OpenAI-Beta': 'assistants=v2'
                    }
                });
                setQueues(data.data);
            } catch (err) {
                toastError(`QUEUESELETSINGLE >>> ${err}`);
            }
        })();
    }, [api_key]);

    return (
        <div style={{ marginTop: 6 }}>
            <FormControl
                variant="outlined"
                className={classes.FormControl}
                margin="dense"
                fullWidth
            >
                <div>
                    <Typography>
                        Assistentes
                    </Typography>
                    <Field
                        as={Select}
                        label={'Assistentes'}
                        name="prompt"
                        labelId="queue-selection-label"
                        id="queue-selection"
                        fullWidth
                    >
                        {queues.map(queue => (
                            <MenuItem key={queue.id} value={queue.id}>
                                {queue.name}
                            </MenuItem>
                        ))}
                    </Field>
                </div>
            </FormControl>
        </div>
    );
};

export default AssistentSelectSingle;

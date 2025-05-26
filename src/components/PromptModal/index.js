import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import { i18n } from "../../translate/i18n";
import { MenuItem, FormControl, InputLabel, Select, Grid, Tab, Box, Tabs, Checkbox, FormControlLabel } from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { InputAdornment, IconButton } from "@material-ui/core";
import QueueSelectSingle from "../../components/QueueSelectSingle";
import AssistentSelectSingle from "../AssistentSelectSingle";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import axios from "axios";
import QueueSelectPart from "../QueueSelectPart";

const useStyles = makeStyles(theme => ({
    root: {
        display: "flex",
        flexWrap: "wrap",
    },
    multFieldLine: {
        display: "flex",
        "& > *:not(:last-child)": {
            marginRight: theme.spacing(1),
        },
    },

    btnWrapper: {
        position: "relative",
    },

    buttonProgress: {
        color: green[500],
        position: "absolute",
        top: "50%",
        left: "50%",
        marginTop: -12,
        marginLeft: -12,
    },
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
    colorAdorment: {
        width: 20,
        height: 20,
    },
}));

const PromptSchema = Yup.object().shape({
    name: Yup.string().min(5, "Muito curto!").max(100, "Muito longo!").required("Obrigatório"),
    prompt: Yup.string().min(50, "Muito curto!").required("Descreva o treinamento para Inteligência Artificial"),
    voice: Yup.string().required("Informe o modo para Voz"),
    max_tokens: Yup.number().required("Informe o número máximo de tokens"),
    temperature: Yup.number().required("Informe a temperatura"),
    apikey: Yup.string().required("Informe a API Key"),
    queueId: Yup.number().required("Informe a fila"),
    max_messages: Yup.number().required("Informe o número máximo de mensagens")
});

const PromptModal = ({ open, onClose, promptId }) => {
    const classes = useStyles();
    const [selectedVoice, setSelectedVoice] = useState("texto");
    const [assitantMode, setAssitantMode] = useState("text");
    const [showApiKey, setShowApiKey] = useState(false);
    const [delayMode, setDelayMode] = useState(false);
    const [voices, setSelectedVoices] = useState([{
        "voice_id": "texto",
        "name": "Texto"
    }]);
    const [messageTab, setMessageTab] = useState(0);
    const [messagesCount, setMessagesCount] = useState(4);

    const [token, setToken] = useState({});

    const handleToggleApiKey = () => {
        setShowApiKey(!showApiKey);
    };

    const handleAddMessage = () => {
        setMessagesCount(prev => {
          const next = prev + 1;
          setMessageTab(next - 1);
          return next;
        });
      };

    const renderMessageTabs = () => (
        <Grid item xs={12}>
            <Tabs
                value={messageTab}
                indicatorColor="primary"
                textColor="primary"
                onChange={(e, v) => setMessageTab(v)}
                variant="scrollable"
                scrollButtons="auto"
            >
                {[...Array(messagesCount)].map((_, index) => (
                    <Tab key={index} label={`Palavra/Frase ${index + 1}`} />
                ))}
            </Tabs>
            <Box style={{ paddingTop: 20 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                        {renderMessageField(`Palavra/Frase ${messageTab + 1}`, `${messageTab + 1}`)}
                    </Grid>
                    <Grid item xs={12} md={4}>
                    <QueueSelectPart key={`queue-select-${messageTab}`} name={`queue${messageTab + 1}Id`} />
                    </Grid>
                </Grid>
                <Grid container justifyContent="flex-end" style={{ marginTop: 16 }}>
                    <Button
                        onClick={handleAddMessage}
                        variant="outlined"
                        color="primary"
                    >
                        Adicionar nova Palavra/Frase
                    </Button>
                </Grid>
            </Box>
        </Grid>
    );


    const initialState = {
        name: "",
        prompt: "",
        voice: "texto",
        voiceKey: "",
        voiceRegion: "",
        maxTokens: 100,
        temperature: 1,
        apiKey: "",
        queueId: null,
        maxMessages: 10,
        message1: '',
        message2: '',
        message3: '',
        message4: '',
        queue1Id: '',
        queue2Id: '',
        queue3Id: '',
        queue4Id: '',
    };

    const [prompt, setPrompt] = useState(initialState);
    useEffect(() => {
        const fetchPrompt = async () => {
          if (!promptId) {
            setPrompt(initialState);
            setMessagesCount(4);
            return;
          }
      
          try {
            const { data } = await api.get(`/prompt/${promptId}`);
            const tokenParsed = parseToken(data.prompt);
      
            let dataToSet = {
              ...data,
              prompt: tokenParsed.assistant?.trim() || '',
            };
      
            if (data.voiceKey) {
              fetchPromptVoice(data.voiceKey);
              dataToSet['voice'] = tokenParsed?.voice;
            }
      
            if (tokenParsed?.assistantMode) {
              setAssitantMode(tokenParsed.assistantMode);
            }
      
            if (tokenParsed?.useDelay) {
              setDelayMode(true);
            }
      
            if (tokenParsed?.relations && tokenParsed.relations.length > 0) {
              const relationMap = {};
              tokenParsed.relations.forEach((rel, index) => {
                relationMap[`message${index + 1}`] =
                  rel.key.trim() === '@!227192739191' ? '' : rel.key.trim();
                relationMap[`queue${index + 1}Id`] =
                  rel.queue.trim() === '@!227192739191' ? '' : Number(rel.queue.trim());
              });
      
              dataToSet = { ...dataToSet, ...relationMap };
              setMessagesCount(tokenParsed.relations.length);
            }
      
            setPrompt(prevState => ({ ...prevState, ...dataToSet }));
            setSelectedVoice(data.voice);
            setMessageTab(0);
          } catch (err) {
            toastError(err);
          }
        };
      
        fetchPrompt();
      }, [promptId, open]);
      

    const fetchPromptVoice = async (key) => {
        try {
            const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
                headers: { 'Content-Type': 'application/json', 'xi-api-key': key }
            });
            setSelectedVoices([{
                "voice_id": "texto",
                "name": "Texto"
            }, ...response.data.voices])
        } catch (err) {
            console.log(err)
        }
    }

    const handleChangeVoiceKey = (e, setFieldValue) => {
        const { value } = e.target;
        // setPrompt((prevState) => ({ ...prevState, [name]: value }));
        setFieldValue("voiceKey", value);
        fetchPromptVoice(value)
    };
    const handleClose = () => {
        setPrompt(initialState);
        setSelectedVoice("texto");
        onClose();
    };

    const handleChangeVoice = (e) => {
        setSelectedVoice(e.target.value);
    };

    const handleSavePrompt = async values => {
        const promptData = { ...values, voice: selectedVoice };
    
        const relations = [];
        for (let i = 1; i <= messagesCount; i++) {
            relations.push({
                queue: values[`queue${i}Id`] || '@!227192739191',
                key: values[`message${i}`] || '@!227192739191',
            });
        }
    
        const dataToToken = {
            assistant: promptData.prompt,
            voice: selectedVoice,
            relations
        };
    
        if (assitantMode) {
            dataToToken['assistantMode'] = assitantMode;
        }
    
        if (delayMode) {
            dataToToken['useDelay'] = 'ativo';
        }
    
        const newToken = createToken(dataToToken);
        promptData['prompt'] = newToken;
    
        try {
            const resp = await api.get("/queue");
            if (promptId) {
                await api.put(`/prompt/${promptId}`, { ...promptData, queueId: resp.data[0].id });
            } else {
                await api.post("/prompt", { ...promptData, queueId: resp.data[0].id });
            }
            toast.success(i18n.t("promptModal.success"));
        } catch (err) {
            toastError(err);
        }
    
        handleClose();
    };
    

    function createToken(data) {
        const BLOCK_DELIMITER = '||--||';
        const TOKEN_KEYS = {
            ASSISTANT: 'assistant',
            QUEUE_KEY: 'queue-key',
            VOICE: 'voice',
            USE_DELAY: 'use-delay',
            ASSISTANT_MODE: 'assistant-mode',
        };

        const tokens = [];

        if (data.assistant) {
            tokens.push(`${TOKEN_KEYS.ASSISTANT}:${data.assistant.trim()}`);
        }

        if (Array.isArray(data.relations)) {
            data.relations.forEach((relation, index) => {
                tokens.push(`${TOKEN_KEYS.QUEUE_KEY}${index + 1}:${relation.queue.toString().trim()}-${relation.key.trim()}`);
            });
        }

        if (data.voice) {
            tokens.push(`${TOKEN_KEYS.VOICE}:${data.voice.trim()}`);
        }

        if (data.useDelay) {
            tokens.push(`${TOKEN_KEYS.USE_DELAY}:${data.useDelay.trim()}`);
        }

        if (data.assistantMode) {
            tokens.push(`${TOKEN_KEYS.ASSISTANT_MODE}:${data.assistantMode.trim()}`);
        }

        return tokens.join(BLOCK_DELIMITER);
    }

    function parseToken(tokenString) {
        const BLOCK_DELIMITER = '||--||';
        const TOKEN_KEYS = {
            ASSISTANT: 'assistant',
            QUEUE_KEY: 'queue-key',
            VOICE: 'voice',
            USE_DELAY: 'use-delay',
            ASSISTANT_MODE: 'assistant-mode'
        };

        if (!tokenString.includes(BLOCK_DELIMITER)) {
            return null;
        }

        const tokens = tokenString.split(BLOCK_DELIMITER);
        const data = {
            assistant: null,
            relations: [],
            voice: null,
            useDelay: null,
            assistantMode: null,
        };

        tokens.forEach((token) => {
            const [key, value] = token.split(':');
            if (key === TOKEN_KEYS.ASSISTANT) {
                data.assistant = value?.trim();
            } else if (key.startsWith(TOKEN_KEYS.QUEUE_KEY)) {
                const [queue, key] = value.split('-');
                data.relations.push({ queue: queue?.trim(), key: key?.trim() });
            } else if (key === TOKEN_KEYS.VOICE) {
                data.voice = value?.trim();
            } else if (key === TOKEN_KEYS.USE_DELAY) {
                data.useDelay = value?.trim();
            } else if (key === TOKEN_KEYS.ASSISTANT_MODE) {
                data.assistantMode = value?.trim();
            }
        });

        return data;
    }

    const renderMessageField = (identifier, name_index) => {
        return (
            <Field
                key={`field-message-${name_index}`}
                as={TextField}
                id={identifier}
                name={`message${name_index}`}
                fullWidth
                rows={3}
                label={identifier}
                placeholder={identifier}
                multiline={true}
                variant="outlined"
            />
        );
    };
    
    return (
        <div className={classes.root}>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="md"
                scroll="paper"
                fullWidth
            >
                <DialogTitle id="form-dialog-title">
                    {promptId
                        ? `${i18n.t("promptModal.title.edit")}`
                        : `${i18n.t("promptModal.title.add")}`}
                </DialogTitle>
                <Formik
                    initialValues={prompt}
                    enableReinitialize={true}
                    onSubmit={(values, actions) => {
                        setTimeout(() => {
                            handleSavePrompt(values);
                            actions.setSubmitting(false);
                        }, 400);
                    }}
                >
                    {({ touched, errors, isSubmitting, setFieldValue, values }) => (
                        <Form style={{ width: "100%" }}>
                            <DialogContent dividers>
                                <Field
                                    as={TextField}
                                    label={i18n.t("promptModal.form.name")}
                                    name="name"
                                    error={touched.name && Boolean(errors.name)}
                                    helperText={touched.name && errors.name}
                                    variant="outlined"
                                    margin="dense"
                                    fullWidth
                                />
                                <FormControl fullWidth margin="dense" variant="outlined">
                                    <Field
                                        as={TextField}
                                        label={i18n.t("promptModal.form.apikey")}
                                        name="apiKey"
                                        type={showApiKey ? 'text' : 'password'}
                                        error={touched.apiKey && Boolean(errors.apiKey)}
                                        helperText={touched.apiKey && errors.apiKey}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={handleToggleApiKey}>
                                                        {showApiKey ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </FormControl>

                                {values.apiKey && <AssistentSelectSingle api_key={values.apiKey} />}

                                {/* <Grid xs={12} item>
                                    <Tabs
                                        value={messageTab}
                                        indicatorColor="primary"
                                        textColor="primary"
                                        className={classes.tabmsg}
                                        onChange={(e, v) => setMessageTab(v)}
                                        variant="fullWidth"
                                        centered
                                        style={{
                                            borderRadius: 2,
                                        }}
                                    >
                                        <Tab label="Palavra/Frase 1" index={0} />
                                        <Tab label="Palavra/Frase 2" index={1} />
                                        <Tab label="Palavra/Frase 3" index={2} />
                                        <Tab label="Palavra/Frase 4" index={3} />
                                    </Tabs>
                                    <Box style={{ paddingTop: 20, border: "none" }}>
                                        {messageTab === 0 &&
                                            <Grid spacing={2} container>
                                                <Grid xs={12} md={8} item>
                                                    <>{renderMessageField("Palavra/Frase 2", '1')}</>
                                                </Grid>
                                                <Grid xs={12} md={4} item>
                                                    <QueueSelectPart name={'queue1Id'} />
                                                </Grid>
                                            </Grid>

                                        }
                                        {messageTab === 1 &&


                                            <Grid spacing={2} container>
                                                <Grid xs={12} md={8} item>
                                                    <>{renderMessageField("Palavra/Frase 2", "2")}</>
                                                </Grid>
                                                <Grid xs={12} md={4} item>
                                                    <QueueSelectPart name={'queue2Id'} />

                                                </Grid>
                                            </Grid>

                                        }
                                        {messageTab === 2 &&


                                            <Grid spacing={2} container>
                                                <Grid xs={12} md={8} item>
                                                    <>{renderMessageField("Palavra/Frase 3", "3")}</>
                                                </Grid>
                                                <Grid xs={12} md={4} item>
                                                    <QueueSelectPart name={'queue3Id'} />

                                                </Grid>
                                            </Grid>

                                        }
                                        {messageTab === 3 &&


                                            <Grid spacing={2} container>
                                                <Grid xs={12} md={8} item>
                                                    <>{renderMessageField("Palavra/Frase 4", "4")}</>
                                                </Grid>
                                                <Grid xs={12} md={4} item>
                                                    <QueueSelectPart name={'queue4Id'} />

                                                </Grid>
                                            </Grid>

                                        }

                                    </Box>
                                </Grid> */}
                                {renderMessageTabs()}

                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={delayMode}
                                            onChange={() => setDelayMode(!delayMode)}
                                            value={delayMode}
                                            color="primary"
                                        />
                                    }
                                    label="Usar Delay"
                                    labelPlacement="start"
                                />
                                <div className={classes.multFieldLine}>
                                    <FormControl fullWidth margin="dense" variant="outlined">
                                        <InputLabel>{i18n.t("promptModal.form.voice")}</InputLabel>
                                        <Select
                                            id="type-select"
                                            labelWidth={60}
                                            name="voice"
                                            value={selectedVoice}
                                            onChange={handleChangeVoice}
                                            multiple={false}
                                        >
                                            {voices.map((v) => <MenuItem key={v.voice_id} value={v.voice_id}>
                                                {v.name}
                                            </MenuItem>)}
                                        </Select>
                                    </FormControl>


                                    <Field
                                        as={TextField}
                                        label={i18n.t("promptModal.form.voiceKey")}
                                        name="voiceKey"
                                        error={touched.voiceKey && Boolean(errors.voiceKey)}
                                        helperText={touched.voiceKey && errors.voiceKey}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                        onChange={(e) => handleChangeVoiceKey(e, setFieldValue)}
                                    />
                                    <FormControl fullWidth margin="dense" variant="outlined">
                                        <InputLabel>Modo do Assistente</InputLabel>
                                        <Select
                                            id="type-select1"
                                            labelWidth={60}
                                            value={assitantMode}
                                            onChange={(e) => setAssitantMode(e.target.value)}
                                            multiple={false}
                                        >
                                            {[{ value: 'text', name: 'Texto' }, { value: 'voice', name: 'Voz' }, { value: 'both', name: 'Ambos' }].map((v) => <MenuItem key={v.value} value={v.value}>
                                                {v.name}
                                            </MenuItem>)}
                                        </Select>
                                    </FormControl>

                                </div>


                            </DialogContent>
                            <DialogActions>
                                <Button
                                    onClick={handleClose}
                                    color="secondary"
                                    disabled={isSubmitting}
                                    variant="outlined"
                                >
                                    {i18n.t("promptModal.buttons.cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    color="primary"
                                    disabled={isSubmitting}
                                    variant="contained"
                                    className={classes.btnWrapper}
                                >
                                    {promptId
                                        ? `${i18n.t("promptModal.buttons.okEdit")}`
                                        : `${i18n.t("promptModal.buttons.okAdd")}`}
                                    {isSubmitting && (
                                        <CircularProgress
                                            size={24}
                                            className={classes.buttonProgress}
                                        />
                                    )}
                                </Button>
                            </DialogActions>
                        </Form>
                    )}
                </Formik>
            </Dialog>
        </div>
    );
};

export default PromptModal;
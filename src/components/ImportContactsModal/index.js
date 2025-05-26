import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, makeStyles, Modal, Typography } from "@material-ui/core";
import { CloseOutlined, FontDownload, ImportContacts } from "@material-ui/icons";
import React, { useState } from "react";
import { FaDownload } from "react-icons/fa";
import * as XLSX from "xlsx";
import { array } from "yup";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexWrap: "wrap",
    },
    dialogImport: {
        minWidth: 500,
    },
    iFile: {
        display: "none"
    },
    lbFile: {
        border: "dashed",
        borderWidth: 2,
        padding: 18,
        cursor: "pointer",
        display: "inline-block",
        width: "70%"
    },
    btnWrapper: {
        position: "relative"
    },
    iconPlanilha: {
        marginRight: 10
    },
    cLbFile: {
        textAlign: "center"
    },
    titleLb: {
        textTransform: "uppercase",
        fontWeight: "bolder",
        marginTop:10
    },
    iconDownload: {
        color: theme.palette.primary.main,
        fontSize: 18
    },
    cModal: {
        paddingTop: 50,
        paddingBottom: 50
    },
    cSuccessContacts: {
        backgroundColor: "#AAEE9C80",
        padding: 10,
        borderRadius: 8,
        marginTop:30
    },
    cErrorContacts: {
        backgroundColor: "#DD011B40",
        padding: 10,
        borderRadius: 8,
        marginTop:30
    },
    titleResult: {
        fontWeight: "bolder"
    },
    cCloseModal: {
        textAlign: "end"
    }
}))

const ImportContactsModal = ( props ) => {

    const classes = useStyles();

    const {
        open,
        onClose
    } = props;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [nameFile, setNameFile] = useState('');
    const [listcontacts, setListContacts] = useState([]);
    const [successUpload, setSuccessUpload] = useState([]);
    const [errorUpload, setErrorUpload] = useState([]);

    const handleNewFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
    
        setNameFile(file.name);
        setListContacts(file); // Guarda o arquivo para enviar posteriormente
    };
    const readXlsx = ( file ) => {

        const reader = new FileReader();
        reader.onload = ( e ) => {

            const ab = e.target.result;
            const wb = XLSX.read(ab,{type: 'array'})

            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            const data = XLSX.utils.sheet_to_json(ws);
            setListContacts(data);
        }

        reader.readAsArrayBuffer(file);
    }

    const handleSaveListContacts = async () => {
        if (!listcontacts) return;
    
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append("file", listcontacts); // Adiciona o arquivo ao FormData
    
        try {
            const { data: responseData } = await api.post("/contacts/upload", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            
            setSuccessUpload(responseData.newContacts || []);
            setErrorUpload(responseData.errorBag || []);

            toast.success("Contatos Importados com sucesso!");
            onClose()

        } catch (e) {
            toast.error("Ocorreu um erro ao importar os contatos. Por favor, tente novamente!");

            toastError(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadModel = (  ) => {
        window.location.href = `${window.location.protocol}//${window.location.host}/import-contatos.xlsx`;
    }

    return (
        <div >
            <Dialog open={open} maxWidth="sm" fullWidth scroll="paper" >
                <DialogTitle>
                    <Grid container alignItems="center">
                        <Grid item xs={6}>
                            Planílha de contatos
                        </Grid>
                        <Grid item xs={6} className={classes.cCloseModal}>
                            <IconButton onClick={onClose}>
                                <CloseOutlined />  
                            </IconButton>                                                                          
                        </Grid>
                    </Grid>
                </DialogTitle>
                <DialogContent dividers className={classes.cModal}>
                    <div className={classes.cLbFile}>
                        <label className={classes.lbFile} htmlFor="i-import-contacts">
                            <FaDownload className={classes.iconDownload} />
                            <div className={classes.titleLb}>
                                Importar contatos
                            </div>
                            {nameFile !== '' && (
                                <div>
                                    ({ nameFile } - {listcontacts.length} resultados)
                                </div> 
                            )}                                                      
                        </label>
                        <input onChange={handleNewFile} className={classes.iFile} type="file" accept=".xlsx" id="i-import-contacts"/>
                    </div>
                    {successUpload.length > 0 && (
                        <div className={classes.cSuccessContacts}>
                            <Typography className={classes.titleResult}>
                                Adicionados:
                            </Typography>
                            {successUpload.map((contact) => (
                                <div>
                                    {contact.contactId} | {contact.contactName} - Contato salvo 
                                </div>
                            ))}
                        </div>
                    )}                    
                    {errorUpload.length > 0 && (
                        <div className={classes.cErrorContacts}>
                            <Typography className={classes.titleResult}>
                                Erros:
                            </Typography>
                            <ul>
                                {errorUpload.map((contact) => (
                                    <li>
                                        {contact.contactName} - {contact.error.message} 
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}                    
                </DialogContent>
                <DialogActions>
                    <Button
                        color="primary"
                        disabled={isSubmitting}
                        variant="outlined"
                        onClick={handleDownloadModel}
                    >
                        <ImportContacts className={classes.iconPlanilha} />
                        Baixar planílha modelo
                    </Button>
                    <Button
                        color="primary"
                        disabled={isSubmitting}
                        variant="contained"
                        className={classes.btnWrapper}
                        onClick={handleSaveListContacts}
                    >
                        Importar contatos
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default ImportContactsModal;

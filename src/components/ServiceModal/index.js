import React, { useState, useEffect, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Grid,
} from "@material-ui/core";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
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
}));

const ServiceModal = ({ open, onClose, serviceId, fetchData }) => {
  const classes = useStyles();

  const initialState = {
    name: "",
    description: "",
    price: "",
    duration: "",
  };

  const [service, setService] = useState(initialState);

  useEffect(() => {
    const fetchService = async () => {
      if (!serviceId) return;
      try {
        const { data } = await api.get(`/services/${serviceId}`);
        setService(data);
      } catch (err) {
        toastError(err);
      }
    };

    fetchService();
  }, [serviceId, open]);

  const handleClose = () => {
    onClose();
    setService(initialState);
  };

  const ServiceSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, i18n.t("serviceModal.validation.tooShort"))
      .max(255, i18n.t("serviceModal.validation.tooLong"))
      .required(i18n.t("serviceModal.validation.required")),
    description: Yup.string(),
    price: Yup.number()
      .positive(i18n.t("serviceModal.validation.invalidPrice"))
      .required(i18n.t("serviceModal.validation.required")),
    duration: Yup.number()
      .positive(i18n.t("serviceModal.validation.invalidDuration"))
      .required(i18n.t("serviceModal.validation.required")),
  });

  const handleSaveService = async (values) => {
    try {
      if (serviceId) {
        await api.put(`/services/${serviceId}`, values);
      } else {
        await api.post("/services", values);
      }
      toast.success(i18n.t("serviceModal.success"));
      fetchData();
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Formik
      initialValues={service}
      enableReinitialize={true}
      validationSchema={ServiceSchema}
      onSubmit={(values, actions) => {
        setTimeout(() => {
          handleSaveService(values);
          actions.setSubmitting(false);
          handleClose();
        }, 400);
      }}
    >
      {({ touched, errors, isSubmitting }) => (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle id="form-dialog-title">
            {serviceId
              ? i18n.t("serviceModal.title.edit")
              : i18n.t("serviceModal.title.add")}
          </DialogTitle>
          <Form>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    label={i18n.t("serviceModal.form.name")}
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    label={i18n.t("serviceModal.form.description")}
                    name="description"
                    error={touched.description && Boolean(errors.description)}
                    helperText={touched.description && errors.description}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    multiline
                    rows={4}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("serviceModal.form.price")}
                    name="price"
                    type="number"
                    error={touched.price && Boolean(errors.price)}
                    helperText={touched.price && errors.price}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("serviceModal.form.duration")}
                    name="duration"
                    type="number"
                    error={touched.duration && Boolean(errors.duration)}
                    helperText={touched.duration && errors.duration}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={handleClose}
                color="secondary"
                disabled={isSubmitting}
                variant="outlined"
              >
                {i18n.t("serviceModal.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={isSubmitting}
                variant="contained"
                className={classes.btnWrapper}
              >
                {serviceId
                  ? i18n.t("serviceModal.buttons.okEdit")
                  : i18n.t("serviceModal.buttons.okAdd")}
                {isSubmitting && (
                  <CircularProgress
                    size={24}
                    className={classes.buttonProgress}
                  />
                )}
              </Button>
            </DialogActions>
          </Form>
        </Dialog>
      )}
    </Formik>
  );
};

export default ServiceModal;

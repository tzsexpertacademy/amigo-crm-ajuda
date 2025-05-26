import React, { useState, useEffect, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field, FastField, FieldArray } from "formik";
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
  Select,
  InputLabel,
  MenuItem,
  FormControl,
  Grid,
  Container,
  Typography,
} from "@material-ui/core";
import NumberFormat from "react-number-format";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import useWhatsApps from "../../hooks/useWhatsApps";
import usePlans from "../../hooks/usePlans";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  multFieldLine: {
    display: "flex",
    width: "100%",
    "& > *": {
      marginRight: theme.spacing(1),
    },
    "& > *:last-child": {
      marginRight: 0,
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
    marginTop: theme.spacing(1),
    minWidth: 120,
    width: "100%",
  },
  maxWidth: {
    width: "100%",
  },
  divider: {
    margin: `${theme.spacing(2)}px 0`,
    borderTop: "1px solid #ccc",
    position: "relative",
    textAlign: "center",
  },
  dividerText: {
    position: "absolute",
    top: -10,
    backgroundColor: "#fff",
    padding: "0 10px",
  },
  textField: {
    marginTop: theme.spacing(1),
  },
  spacingBetweenSections: {
    marginTop: theme.spacing(3),
  },
}));

const UserModal = ({ open, onClose, userId }) => {
  const classes = useStyles();

  const initialState = {
    name: "",
    email: "",
    password: "",
    profile: "user",
    allTicket: "desabled",
    whatsappId: "",
    profession: "",
    appointmentSpacing: "",
    profissionalService: "",
    appointmentSpacingUnit: "min",
    body_one_hour: "",
    body_ten_min: "",
    body: "",
    schedules: [
      { weekday: "Segunda-feira", weekdayEn: "monday", startTime: "", endTime: "" },
      { weekday: "Terça-feira", weekdayEn: "tuesday", startTime: "", endTime: "" },
      { weekday: "Quarta-feira", weekdayEn: "wednesday", startTime: "", endTime: "" },
      { weekday: "Quinta-feira", weekdayEn: "thursday", startTime: "", endTime: "" },
      { weekday: "Sexta-feira", weekdayEn: "friday", startTime: "", endTime: "" },
      { weekday: "Sábado", weekdayEn: "saturday", startTime: "", endTime: "" },
      { weekday: "Domingo", weekdayEn: "sunday", startTime: "", endTime: "" },
    ],
  };

  const { user: loggedInUser } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();

  const [user, setUser] = useState(initialState);
  const [services, setServices] = useState([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const { loading, whatsApps } = useWhatsApps();
  const [showAppointments, setShowAppointments] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;
      try {
        const { data } = await api.get(`/users/${userId}`);
        setUser((prevState) => ({
          ...prevState,
          ...data,
          schedules: data?.schedules && data?.schedules?.length > 0 ? data.schedules : prevState.schedules,
        }));
        const userQueueIds = data.queues?.map((queue) => queue.id);
        setSelectedQueueIds(userQueueIds);
      } catch (err) {
        toastError(err);
      }
    };
    const fetchData = async () => {
      try {
        const { data } = await api.get("/service/panel", {
          params: { noLimit: 1 },
        });
        setServices(data?.services);
      } catch (err) {
        toastError(err);
      }
    };

    fetchData();
    fetchUser();
  }, [userId, open]);
  useEffect(() => {
    async function fetchData() {
      const companyId = loggedInUser.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);


      setShowAppointments(planConfigs.plan.useAppointments);

    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleClose = () => {
    onClose();
    setUser(initialState);
    setSelectedQueueIds([]);
  };

  const UserSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, i18n.t("userModal.validation.tooShort"))
      .max(50, i18n.t("userModal.validation.tooLong"))
      .required(i18n.t("userModal.validation.required")),

    password: Yup.string()
      .test("password-validation", i18n.t("userModal.validation.tooShort"), function (value) {
        if (userId && !value) return true; // Permite senha vazia na edição
        return value && value.length >= 5;
      })
      .max(50, i18n.t("userModal.validation.tooLong")),

    email: Yup.string()
      .email(i18n.t("userModal.validation.invalidEmail"))
      .required(i18n.t("userModal.validation.required")),

    profile: Yup.string().required(i18n.t("userModal.validation.required")),

    allTicket: Yup.string().required(i18n.t("userModal.validation.required")),

    profession: Yup.string()
      .nullable() // 👈 permite null
      .test("profession-required", i18n.t("userModal.validation.required"), function (value) {
        return this.parent.profile !== "professional" || !!value;
      }),

    appointmentSpacing: Yup.string()
      .nullable() // 👈 permite null
      .test("appointmentSpacing-required", i18n.t("userModal.validation.required"), function (value) {
        return this.parent.profile !== "professional" || !!value;
      }),

    appointmentSpacingUnit: Yup.string()
      .nullable() // 👈 permite null
      .test("appointmentSpacingUnit-required", i18n.t("userModal.validation.required"), function (value) {
        return this.parent.profile !== "professional" || !!value;
      }),


    schedules: Yup.array()
      .nullable() // 👈 permite null
      .test("schedules-required", i18n.t("userModal.validation.required"), function (value) {
        if (this.parent.profile !== "professional") return true;
        return value.every(
          (schedule) => schedule.startTime && schedule.endTime
        );
      }),
  });


  const handleSaveUser = async (values) => {
    const userData = {
      ...values,
      queueIds: selectedQueueIds,
      body_one_hour: values?.body_one_hour ?? "",
      body_ten_min: values?.body_ten_min ?? "",
      body: values?.body ?? "",
    };

    try {
      if (userId) {
        await api.put(`/users/${userId}`, userData);
      } else {
        await api.post("/users", userData);
      }
      toast.success(i18n.t("userModal.success"));
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };


  return (
    <Formik
      initialValues={user}
      enableReinitialize={true}
      validationSchema={UserSchema}
      onSubmit={(values, actions) => {
        setTimeout(() => {
          handleSaveUser(values);
          actions.setSubmitting(false);
        }, 400);
      }}
    >
      {({ touched, errors, isSubmitting, values, setFieldValue, validateForm, submitForm }) => {
        console.log("Erros de Validação:", errors);
        console.log("Campos Tocadas:", touched);
        console.log("Valores do Formulário:", values);

        return <Dialog
          open={open}
          onClose={handleClose}
          maxWidth={values.profile === "professional" ? "md" : "xs"}
          fullWidth
          scroll="paper"
        >
          <DialogTitle id="form-dialog-title">
            {userId
              ? `${i18n.t("userModal.title.edit")}`
              : `${i18n.t("userModal.title.add")}`}
          </DialogTitle>
          <Form>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("userModal.form.name")}
                    autoFocus
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("userModal.form.password")}
                    type="password"
                    name="password"
                    error={touched.password && Boolean(errors.password)}
                    helperText={touched.password && errors.password}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    label={i18n.t("userModal.form.email")}
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    error={touched.profile && Boolean(errors.profile)}
                  >
                    <Can
                      role={loggedInUser.profile}
                      perform="user-modal:editProfile"
                      yes={() => (
                        <>
                          <InputLabel id="profile-selection-label">
                            {i18n.t("userModal.form.profile")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("userModal.form.profile")}
                            name="profile"
                            labelId="profile-selection-label"
                            id="profile-selection"
                            required
                            onChange={(e) => {
                              setFieldValue("profile", e.target.value);
                            }}
                          >
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="user">User</MenuItem>
                            {showAppointments && <MenuItem value="professional">
                              Profissional
                            </MenuItem>}
                          </Field>
                        </>
                      )}
                    />
                    {touched.profile && errors.profile && (
                      <div className="error">{errors.profile}</div>
                    )}
                  </FormControl>
                </Grid>
                {values.profile === "professional" && (
                  <>
                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label="Profissão"
                        name="profession"
                        error={touched.profession && Boolean(errors.profession)}
                        helperText={touched.profession && errors.profession}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <div className={classes.multFieldLine}>
                        <Field
                          as={TextField}
                          label="Intervalo"
                          name="appointmentSpacing"
                          error={
                            touched.appointmentSpacing &&
                            Boolean(errors.appointmentSpacing)
                          }
                          helperText={
                            touched.appointmentSpacing &&
                            errors.appointmentSpacing
                          }
                          variant="outlined"
                          margin="dense"
                          fullWidth
                        />
                        <FormControl
                          variant="outlined"
                          margin="dense"
                          className={classes.formControl}
                          error={
                            touched.appointmentSpacingUnit &&
                            Boolean(errors.appointmentSpacingUnit)
                          }
                        >
                          <InputLabel id="spacing-unit-label">
                            Unidade
                          </InputLabel>
                          <Field
                            as={Select}
                            label="Unidade"
                            name="appointmentSpacingUnit"
                            labelId="spacing-unit-label"
                            id="spacing-unit"
                          >
                            <MenuItem value="min">Min</MenuItem>
                            <MenuItem value="hours">Horas</MenuItem>
                          </Field>
                        </FormControl>
                      </div>
                    </Grid>
                    <Grid
                      item
                      xs={12}
                      className={classes.spacingBetweenSections}
                    >
                      {/* Schedule Fields */}
                      <FieldArray
                        name="schedules"
                        render={() => (
                          <Grid container spacing={2}>
                            {values.schedules.map((item, index) => (
                              <Grid
                                container
                                item
                                spacing={1}
                                key={index}
                                alignItems="center"
                              >
                                <Grid item xs={12} md={4}>
                                  <FastField
                                    as={TextField}
                                    label="Dia da Semana"
                                    name={`schedules[${index}].weekday`}
                                    disabled
                                    variant="outlined"
                                    margin="dense"
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <FastField name={`schedules[${index}].startTime`}>
                                    {({ field }) => (
                                      <NumberFormat
                                        label="Hora Inicial"
                                        {...field}
                                        variant="outlined"
                                        margin="dense"
                                        customInput={TextField}
                                        format="##:##"
                                        fullWidth
                                      />
                                    )}
                                  </FastField>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <FastField name={`schedules[${index}].endTime`}>
                                    {({ field }) => (
                                      <NumberFormat
                                        label="Hora Final"
                                        {...field}
                                        variant="outlined"
                                        margin="dense"
                                        customInput={TextField}
                                        format="##:##"
                                        fullWidth
                                      />
                                    )}
                                  </FastField>
                                </Grid>
                              </Grid>
                            ))}
                          </Grid>
                        )}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="subtitle1" gutterBottom>
                        Selecione os Serviços
                      </Typography>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel id="profissional-services-label">Serviços</InputLabel>
                        <Field
                          as={Select}
                          multiple
                          label="Serviços"
                          name="profissionalService"
                          labelId="profissional-services-label"
                          id="profissional-services"
                          value={values.profissionalService || []}
                          onChange={(e) => setFieldValue("profissionalService", e.target.value)}
                          renderValue={(selected) =>
                            services
                              .filter((service) => selected.includes(service.id))
                              .map((service) => service.name)
                              .join(", ")
                          }
                        >
                          {services?.map((service) => (
                            <MenuItem key={service.id} value={service.id}>
                              {service.name}
                            </MenuItem>
                          ))}
                        </Field>
                      </FormControl>
                    </Grid>


                    {/* NOVA SEÇÃO: Configurações de Mensagens da Agenda */}
                    <Grid item xs={12}>
                      <Typography variant="h6" style={{ fontWeight: "bold", color: "#3f51b5", marginTop: 20 }}>
                        Configurações de Mensagens da Agenda
                      </Typography>
                    </Grid>

                    {/* <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <Field
                          as={TextField}
                          id="body_one_hour"
                          name="body_one_hour"
                          label="Mensagem 1h antes"
                          placeholder="Mensagem enviada 1 hora antes..."
                          variant="outlined"
                          fullWidth
                          error={touched.body_one_hour && Boolean(errors.body_one_hour)}
                          helperText={touched.body_one_hour && errors.body_one_hour}
                        />
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <Field
                          as={TextField}
                          id="body_ten_min"
                          name="body_ten_min"
                          label="Mensagem 10 min antes"
                          placeholder="Mensagem enviada 10 minutos antes..."
                          variant="outlined"
                          fullWidth
                          error={touched.body_ten_min && Boolean(errors.body_ten_min)}
                          helperText={touched.body_ten_min && errors.body_ten_min}
                        />
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <Field
                          as={TextField}
                          id="body"
                          name="body"
                          label="Mensagem no horário marcado"
                          placeholder="Mensagem enviada no horário marcado..."
                          variant="outlined"
                          fullWidth
                          error={touched.body && Boolean(errors.body)}
                          helperText={touched.body && errors.body}
                        />
                      </FormControl>
                    </Grid> */}
                  </>
                )}

                <Grid item xs={12}>
                  <Can
                    role={loggedInUser.profile}
                    perform="user-modal:editQueues"
                    yes={() => (
                      <QueueSelect
                        selectedQueueIds={selectedQueueIds}
                        onChange={(values) => setSelectedQueueIds(values)}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Can
                    role={loggedInUser.profile}
                    perform="user-modal:editProfile"
                    yes={() =>
                      !loading && (
                        <FormControl
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          error={touched.allTicket && Boolean(errors.allTicket)}
                        >
                          <InputLabel id="allTicket-selection-label">
                            {i18n.t("userModal.form.allTicket")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("userModal.form.allTicket")}
                            name="allTicket"
                            labelId="allTicket-selection-label"
                            id="allTicket-selection"
                            required
                          >
                            <MenuItem value="enabled">
                              {i18n.t("userModal.form.allTicketEnabled")}
                            </MenuItem>
                            <MenuItem value="desabled">
                              {i18n.t("userModal.form.allTicketDesabled")}
                            </MenuItem>
                          </Field>
                        </FormControl>
                      )
                    }
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
                {i18n.t("userModal.buttons.cancel")}
              </Button>
              <Button
                type="button"
                color="primary"
                disabled={isSubmitting}
                variant="contained"
                className={classes.btnWrapper}
                onClick={async () => {
                  console.log("🧐 Validando o formulário...");

                  const validationErrors = await validateForm();

                  if (Object.keys(validationErrors).length > 0) {
                    console.error("❌ Erros encontrados:", validationErrors);
                  } else {
                    console.log("✅ Nenhum erro encontrado. Enviando formulário...");
                    submitForm();
                  }
                }}
              >
                {userId
                  ? `${i18n.t("userModal.buttons.okEdit")}`
                  : `${i18n.t("userModal.buttons.okAdd")}`}
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
      }
      }
    </Formik>
  );
};

export default UserModal;

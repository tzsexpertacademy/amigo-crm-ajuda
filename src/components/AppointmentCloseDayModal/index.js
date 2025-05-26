import React, { useState, useEffect, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import MenuItem from "@material-ui/core/MenuItem";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import moment from "moment";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
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
}));

const AppointmentSchema = Yup.object().shape({
  description: Yup.string().required("Obrigatório"),
  scheduledDate: Yup.string().required("Obrigatório"),
  status: Yup.string().required("Obrigatório"),
  serviceId: Yup.number().nullable(),
});

const AppointmentCloseDayModal = ({ open, onClose, appointmentId, reload }) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);

  const [appointment, setAppointment] = useState({
    description: "",
    scheduledDate: moment().format("YYYY-MM-DDTHH:mm"),
    status: "pending",
    serviceId: "",
  });

  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get("/users/professional/panel", {
          params: { noLimit: 1 },
        });
        setUsers(data);
      } catch (err) {
        toastError(err);
      }
    };
    if (open && appointmentId) {
      api.get(`/appointments/panel/${appointmentId}`)
        .then(({ data }) => {
          setAppointment({
            ...data,
            scheduledDate: moment(data.scheduledDate).format("YYYY-MM-DDTHH:mm"),
            serviceId: data.service ? data.service.id : "",
          });
        })
        .catch(toastError);
    }

    fetchData()
  }, [open, appointmentId]);

  const handleSaveAppointment = async (values) => {
    try {
      if (appointmentId) {
        await api.put(`/appointments/${appointmentId}`, { ...values, closeDay: true });
      } else {
        await api.post("/appointments", values);
      }
      toast.success(i18n.t("appointmentModal.success"));
      reload();
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth scroll="paper">
      <DialogTitle>Agendamento</DialogTitle>
      <Formik
        initialValues={appointment}
        enableReinitialize
        validationSchema={AppointmentSchema}
        onSubmit={handleSaveAppointment}
      >
        {({ isSubmitting }) => (
          <Form>
            <DialogContent dividers>
              <Field
                as={TextField}
                label="Descrição"
                name="description"
                variant="outlined"
                fullWidth
                margin="dense"
              />
              <Field
                as={TextField}
                label="Data que estará indisponível"
                type="date"
                name="scheduledDate"
                variant="outlined"
                fullWidth
                margin="dense"
                InputLabelProps={{ shrink: true }}
              />

              <Field
                as={TextField}
                select
                label="Status"
                name="status"
                variant="outlined"
                fullWidth
                margin="dense"
              >
                <MenuItem value="closed">Fechado</MenuItem>
              </Field>
              <Field
                as={TextField}
                select
                label="Profissional"
                name="userId"
                variant="outlined"
                fullWidth
                margin="dense"
              >
                <MenuItem value="">Nenhum</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user?.name}
                  </MenuItem>
                ))}
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} color="secondary" variant="outlined">
                Cancelar
              </Button>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                disabled={isSubmitting}
                className={classes.btnWrapper}
              >
                Salvar
                {isSubmitting && <CircularProgress size={24} className={classes.buttonProgress} />}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default AppointmentCloseDayModal;

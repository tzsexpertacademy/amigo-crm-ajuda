import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ServiceModal from "../../components/ServiceModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_USERS") {
    const services = action.payload;
    const updatedState = [...state];
  
    services.forEach((service) => {
      const index = updatedState.findIndex((u) => u.id === service.id);
      if (index !== -1) {
        updatedState[index] = service; // Substitui se já existir
      } else {
        updatedState.push(service); // Adiciona se for novo
      }
    });
  
    return updatedState;
  }
  
  
  

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const Services = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [deletingService, setDeletingService] = useState(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [services, dispatch] = useReducer(reducer, []);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  const fetchData = async (isToReset = false) => {
    if(isToReset) dispatch({ type: "RESET" });
    try {
      const { data } = await api.get("/service/panel", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_USERS", payload: data.services });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      
      fetchData();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-service`, (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_USERS", payload: data.service });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_USER", payload: +data.serviceId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [socketManager]);

  const handleOpenServiceModal = () => {
    setSelectedService(null);
    setServiceModalOpen(true);
  };

  const handleCloseServiceModal = () => {
    setSelectedService(null);
    setServiceModalOpen(false);
    fetchData();
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = (user) => {
    setSelectedService(user);
    setServiceModalOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/services/${userId}`);
      dispatch({ type: "DELETE_USER", payload: userId });
      // fetchData();
      toast.success(i18n.t("services.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingService(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingService &&
          `${i18n.t("services.confirmationModal.deleteTitle")} ${
            deletingService.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteUser(deletingService.id)}
      >
        {i18n.t("services.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <ServiceModal
        open={serviceModalOpen}
        onClose={handleCloseServiceModal}
        aria-labelledby="form-dialog-title"
        serviceId={selectedService && selectedService.id}
      />
      <MainHeader>
        <Title>{i18n.t("services.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenServiceModal}
          >
            {i18n.t("services.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
			<TableCell align="center">
                {i18n.t("services.table.id")}
              </TableCell>
              <TableCell align="center">{i18n.t("services.table.name")}</TableCell>
              <TableCell align="center">
                Descrição
              </TableCell>
              <TableCell align="center">
                Preço
              </TableCell>
              <TableCell align="center">
                Duração (Média)
              </TableCell>
              <TableCell align="center">
                {i18n.t("services.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {services.map((service) => (
                <TableRow key={service.id}>
				  <TableCell align="center">{service.id}</TableCell>
                  <TableCell align="center">{service?.name}</TableCell>
                  <TableCell align="center">{service?.description}</TableCell>
                  <TableCell align="center">{service?.price}</TableCell>
                  <TableCell align="center">{service?.duration}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleEditUser(service)}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setConfirmModalOpen(true);
                        setDeletingService(service);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={4} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Services;

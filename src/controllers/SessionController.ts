import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";

import AuthUserService from "../services/UserServices/AuthUserService";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import { RefreshTokenService } from "../services/AuthServices/RefreshTokenService";
import FindUserFromToken from "../services/AuthServices/FindUserFromToken";
import User from "../models/User";
const { exec } = require("child_process");

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  const { token, serializedUser, refreshToken } = await AuthUserService({
    email,
    password
  });

  SendRefreshToken(res, refreshToken);

  const io = getIO();
  io.to(`user-${serializedUser.id}`).emit(`company-${serializedUser.companyId}-auth`, {
    action: "update",
    user: {
      id: serializedUser.id,
      email: serializedUser.email,
      companyId: serializedUser.companyId
    }
  });

  return res.status(200).json({
    token,
    user: serializedUser
  });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const token: string = req.cookies.jrt;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const { user, newToken, refreshToken } = await RefreshTokenService(
    res,
    token
  );
 
  SendRefreshToken(res, refreshToken);

  return res.json({ token: newToken, user });
};

export const me = async (req: Request, res: Response): Promise<Response> => {
  const token: string = req.cookies.jrt;
  const user = await FindUserFromToken(token);
  const { id, profile, super: superAdmin } = user;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  return res.json({ id, profile, super: superAdmin });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.user;
  const user = await User.findByPk(id);
  await user.update({ online: false });

  res.clearCookie("jrt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    expires: new Date(0),
  });

  return res.send();
};

export const refreshApi = async (req: Request, res: Response): Promise<Response> => {
  const restartApplication = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log("Conexão com o banco perdida. Reiniciando a aplicação...");


      exec("pm2 restart 2 workers", (error, stdout, stderr) => {

        if (error) {
          console.error(`Erro ao reiniciar a aplicação via PM2: ${error.message}`);
          return reject(new Error(`Erro ao reiniciar a aplicação via PM2: ${error.message}`));
        }
        if (stderr) {
          console.error(`Erro do PM2: ${stderr}`);
          return reject(new Error(`Erro do PM2: ${stderr}`));
        }
        console.log(`Aplicação reiniciada via PM2: ${stdout}`);

        exec("sudo systemctl restart postgresql", (error, stdout, stderr) => {
          if (error) {
            console.error(`Erro ao reiniciar o postgresql: ${error.message}`);
            return reject(new Error(`Erro ao reiniciar o postgresql: ${error.message}`));
          }
          if (stderr) {
            console.error(`Erro ao reiniciar o postgresql: ${stderr}`);
            return reject(new Error(`Erro ao reiniciar o postgresql: ${stderr}`));
          }
          console.log(`Postgresql reiniciado: ${stdout}`);
          resolve(); // Resolva a promessa após ambas as operações concluírem
        });
      });
    });
  };

  try {
    restartApplication();
    return res.status(200).json({ message: "API reiniciada com sucesso." });
  } catch (error: any) {
    console.error(error.message);
    return res.status(500).json({ error: error.message });
  }
};

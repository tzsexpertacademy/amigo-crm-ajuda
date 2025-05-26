import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User";

export interface IFinancialGoal extends Document {
  title: string;
  description?: string;
  targetAmount: number; // Valor da meta
  accumulatedAmount: number; // Valor já acumulado
  monthlyDeposit: number; // Valor sugerido para depósito mensal
  dueDate: Date; // Data limite para atingir a meta
  status: "in_progress" | "completed" | "cancelled"; // Status da meta
  user: IUser | mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const FinancialGoalSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    targetAmount: { type: Number, required: true },
    accumulatedAmount: { type: Number, default: 0 },
    monthlyDeposit: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["in_progress", "completed", "cancelled"], default: "in_progress" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const FinancialGoal = mongoose.model<IFinancialGoal>(
  "FinancialGoal",
  FinancialGoalSchema
);

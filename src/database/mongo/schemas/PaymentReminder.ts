import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User";

export interface IPaymentReminder extends Document {
  title: string;
  description?: string;
  date: Date;
  type: "income" | "expense"; // Define se é entrada ou saída
  user: IUser | mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const PaymentReminderSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const PaymentReminder = mongoose.model<IPaymentReminder>(
  "PaymentReminder",
  PaymentReminderSchema
);

import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  phoneNumber: string;
  loginAttempts: number;
}

const LeadSchema: Schema = new Schema(
  {
    phoneNumber: { type: String, required: true, unique: true },
    loginAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);

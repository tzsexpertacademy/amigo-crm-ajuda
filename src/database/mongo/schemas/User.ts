import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  phoneNumber: string;
  contactId: string;
  activeCode: string;
  expDate: Date;
  referral?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status: string;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: false, unique: false },
    phoneNumber: { type: String, required: true },
    contactId: { type: String, required: false },
    activeCode: { type: String, required: true },
    expDate: { type: Date, required: true },
    referral: { type: String },
    status: { type: String, required: true, enum: ['active', 'inactive', 'pending'], default: 'pending' },
  },
  { timestamps: true } // Adiciona automaticamente os campos createdAt e updatedAt
);

export const User = mongoose.model<IUser>('User', UserSchema);

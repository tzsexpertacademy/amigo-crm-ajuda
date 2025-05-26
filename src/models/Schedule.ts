import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";

@Table
class Schedule extends Model<Schedule> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.TEXT)
  body: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  body_first_aux: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  body_second_aux: string | null;

  @Column
  sendAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  sendAt_first_aux: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  sendAt_second_aux: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  sentAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  sentAt_first_aux: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  sentAt_second_aux: Date | null;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @ForeignKey(() => Ticket)
  @Column({
    allowNull: true
  })
  ticketId: number | null;

  @ForeignKey(() => User)
  @Column({
    allowNull: true
  })
  userId: number | null;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @Column(DataType.STRING)
  status: string;
  
  @Column(DataType.STRING)
  sendStatus: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @BelongsTo(() => User)
  user: User;

  @BelongsTo(() => Company)
  company: Company;

  @Column({
    allowNull: true
  })
  mediaPath: string | null;

  @Column({
    allowNull: true
  })
  mediaName: string | null;
}

export default Schedule;

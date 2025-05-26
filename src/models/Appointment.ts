import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    DataType,
    ForeignKey,
    BelongsTo,
  } from "sequelize-typescript";
  import User from "./User";
  import Services from "./Service";
  import Ticket from "./Ticket";

  @Table({
    tableName: "Appointment",
  })
  class Appointment extends Model<Appointment> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;
 
    @Column(DataType.DATE)
    scheduledDate: Date;

    @Column(DataType.TEXT)
    description: string;

    @Column({ defaultValue: "pending" })
    status: string;

    @ForeignKey(() => User)
    @Column
    userId: number;
    
    @ForeignKey(() => Services)
    @Column
    serviceId: number;

    @BelongsTo(() => Services)
    service: Services; 

    @BelongsTo(() => User)
    user: User;

    @ForeignKey(() => Ticket)
    @Column
    ticketId: number;

    @BelongsTo(() => Ticket)
    ticket: Ticket;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
  }

  export default Appointment;

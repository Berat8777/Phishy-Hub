import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { Ticket } from './ticket.model';

export class TicketComment extends Model<InferAttributes<TicketComment>, InferCreationAttributes<TicketComment>> {
  declare id: CreationOptional<string>;
  declare ticketId: ForeignKey<Ticket['id']>;
  declare authorId: ForeignKey<User['id']>;
  declare body: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TicketComment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tickets', key: 'id' },
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'TicketComment',
    tableName: 'ticket_comments',
    underscored: true,
  },
);

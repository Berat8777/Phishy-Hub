import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { Channel } from './channel.model';

export class Meeting extends Model<InferAttributes<Meeting>, InferCreationAttributes<Meeting>> {
  declare id: CreationOptional<string>;
  declare title: string;
  declare description: string | null;
  declare organizerId: ForeignKey<User['id']>;
  declare startTime: Date;
  declare endTime: Date;
  declare location: string | null;
  declare channelId: ForeignKey<Channel['id']> | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Meeting.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    organizerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'channels', key: 'id' },
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Meeting',
    tableName: 'meetings',
    underscored: true,
  },
);

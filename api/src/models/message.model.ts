import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import { Channel } from './channel.model';
import { User } from './user.model';
import { MESSAGE_TYPES, MessageType } from '../utils/constants';

export class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
  declare id: CreationOptional<string>;
  declare channelId: ForeignKey<Channel['id']>;
  declare senderId: ForeignKey<User['id']>;
  declare body: string | null;
  declare type: CreationOptional<MessageType>;
  declare replyToMessageId: ForeignKey<Message['id']> | null;
  declare editedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  // Populated only when eager-loaded via `include: [{ association: 'sender' }]`.
  declare sender?: NonAttribute<User>;
}

Message.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'channels', key: 'id' },
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM(...MESSAGE_TYPES),
      allowNull: false,
      defaultValue: 'text',
    },
    replyToMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'messages', key: 'id' },
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    underscored: true,
    paranoid: true,
  },
);

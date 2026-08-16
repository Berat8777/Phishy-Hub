import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Message } from './message.model';
import { User } from './user.model';

export class MessageReaction extends Model<InferAttributes<MessageReaction>, InferCreationAttributes<MessageReaction>> {
  declare id: CreationOptional<string>;
  declare messageId: ForeignKey<Message['id']>;
  declare userId: ForeignKey<User['id']>;
  declare emoji: string;
  declare createdAt: CreationOptional<Date>;
}

MessageReaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    messageId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'messages', key: 'id' },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    emoji: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'MessageReaction',
    tableName: 'message_reactions',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ['message_id', 'user_id', 'emoji'] }],
  },
);

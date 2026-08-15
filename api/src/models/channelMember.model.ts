import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Channel } from './channel.model';
import { User } from './user.model';
import { Message } from './message.model';
import { CHANNEL_MEMBER_ROLES, ChannelMemberRole } from '../utils/constants';

export class ChannelMember extends Model<InferAttributes<ChannelMember>, InferCreationAttributes<ChannelMember>> {
  declare id: CreationOptional<string>;
  declare channelId: ForeignKey<Channel['id']>;
  declare userId: ForeignKey<User['id']>;
  declare channelRole: ChannelMemberRole;
  declare lastReadMessageId: ForeignKey<Message['id']> | null;
  declare lastReadAt: Date | null;
  declare joinedAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ChannelMember.init(
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    channelRole: {
      type: DataTypes.ENUM(...CHANNEL_MEMBER_ROLES),
      allowNull: false,
      defaultValue: 'member',
    },
    lastReadMessageId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'messages', key: 'id' },
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'ChannelMember',
    tableName: 'channel_members',
    underscored: true,
    indexes: [{ unique: true, fields: ['channel_id', 'user_id'] }],
  },
);

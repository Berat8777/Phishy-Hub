import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Meeting } from './meeting.model';
import { User } from './user.model';
import { RSVP_STATUSES, RsvpStatus } from '../utils/constants';

export class MeetingParticipant extends Model<
  InferAttributes<MeetingParticipant>,
  InferCreationAttributes<MeetingParticipant>
> {
  declare id: CreationOptional<string>;
  declare meetingId: ForeignKey<Meeting['id']>;
  declare userId: ForeignKey<User['id']>;
  declare rsvpStatus: CreationOptional<RsvpStatus>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

MeetingParticipant.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    meetingId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'meetings', key: 'id' },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    rsvpStatus: {
      type: DataTypes.ENUM(...RSVP_STATUSES),
      allowNull: false,
      defaultValue: 'invited',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'MeetingParticipant',
    tableName: 'meeting_participants',
    underscored: true,
    indexes: [{ unique: true, fields: ['meeting_id', 'user_id'] }],
  },
);

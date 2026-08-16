import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { LeaveRequest } from './leaveRequest.model';
import {
  LEAVE_REQUEST_REVIEW_DECISIONS,
  LEAVE_REQUEST_REVIEW_STAGES,
  LeaveRequestReviewDecision,
  LeaveRequestReviewStage,
} from '../utils/constants';

/**
 * Full audit trail of every stage decision on a leave request — the source
 * of truth for rendering an approval stepper client-side. `LeaveRequest`'s
 * own `reviewedById`/`reviewedAt`/`reviewNote` columns stay a denormalized
 * pointer to only the FINAL decision, kept for backward compatibility with
 * anything already reading those columns (see leaveRequest.service.ts).
 */
export class LeaveRequestReview extends Model<
  InferAttributes<LeaveRequestReview>,
  InferCreationAttributes<LeaveRequestReview>
> {
  declare id: CreationOptional<string>;
  declare leaveRequestId: ForeignKey<LeaveRequest['id']>;
  declare reviewerId: ForeignKey<User['id']>;
  declare stage: LeaveRequestReviewStage;
  declare decision: LeaveRequestReviewDecision;
  declare note: string | null;
  declare createdAt: CreationOptional<Date>;
}

LeaveRequestReview.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    leaveRequestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'leave_requests', key: 'id' },
    },
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    stage: {
      type: DataTypes.ENUM(...LEAVE_REQUEST_REVIEW_STAGES),
      allowNull: false,
    },
    decision: {
      type: DataTypes.ENUM(...LEAVE_REQUEST_REVIEW_DECISIONS),
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'LeaveRequestReview',
    tableName: 'leave_request_reviews',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);

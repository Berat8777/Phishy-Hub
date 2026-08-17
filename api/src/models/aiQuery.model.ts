import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { User } from './user.model';
import { Channel } from './channel.model';
import { Message } from './message.model';
import { AiIndexRun } from './aiIndexRun.model';
import { AI_QUERY_STATUSES, AiQueryStatus } from '../utils/constants';

export interface AiQueryCitation {
  documentId: string;
  path: string;
  startLine: number;
  endLine: number;
  heading: string | null;
  score: number;
  referenced: boolean;
}

export class AiQuery extends Model<InferAttributes<AiQuery>, InferCreationAttributes<AiQuery>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User['id']>;
  declare parentQueryId: ForeignKey<AiQuery['id']> | null;
  declare channelId: ForeignKey<Channel['id']> | null;
  declare messageId: ForeignKey<Message['id']> | null;
  declare indexRunId: ForeignKey<AiIndexRun['id']> | null;
  declare question: string;
  declare answer: string | null;
  declare citations: CreationOptional<AiQueryCitation[]>;
  declare provider: string;
  declare model: string | null;
  declare inputTokens: number | null;
  declare outputTokens: number | null;
  declare latencyMs: number | null;
  declare status: CreationOptional<AiQueryStatus>;
  declare errorCode: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AiQuery.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    parentQueryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'ai_queries', key: 'id' },
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'channels', key: 'id' },
    },
    messageId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'messages', key: 'id' },
    },
    indexRunId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'ai_index_runs', key: 'id' },
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    answer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    citations: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    provider: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    inputTokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    outputTokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    latencyMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...AI_QUERY_STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    },
    errorCode: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'AiQuery',
    tableName: 'ai_queries',
    underscored: true,
  },
);

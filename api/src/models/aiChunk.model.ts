import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { AiIndexRun } from './aiIndexRun.model';
import { AiDocument } from './aiDocument.model';

/**
 * `embedding` (pgvector) and `tsv` (generated tsvector) are deliberately NOT
 * declared here — Sequelize 6 has no vector/tsvector DataType. Both columns
 * are read/written exclusively via raw parameterized `sequelize.query` calls
 * in services/ai/indexing.service.ts and services/ai/retrieval.service.ts,
 * mirroring channel.service.ts::attachChannelListMeta's "raw SQL because
 * Sequelize can't express this" precedent.
 */
export class AiChunk extends Model<InferAttributes<AiChunk>, InferCreationAttributes<AiChunk>> {
  declare id: CreationOptional<string>;
  declare indexRunId: ForeignKey<AiIndexRun['id']>;
  declare documentId: ForeignKey<AiDocument['id']>;
  declare chunkIndex: number;
  declare startLine: number;
  declare endLine: number;
  declare heading: string | null;
  declare content: string;
  declare charCount: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

AiChunk.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    indexRunId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ai_index_runs', key: 'id' },
    },
    documentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'ai_documents', key: 'id' },
    },
    chunkIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    startLine: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    endLine: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    heading: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    charCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'AiChunk',
    tableName: 'ai_chunks',
    underscored: true,
  },
);

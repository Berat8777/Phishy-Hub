import { FindOptions, Model, ModelStatic, Order } from 'sequelize';
import type { PaginationMeta } from '../utils/response';
import { BadRequestError } from '../utils/errors';

/**
 * Offset pagination — used for every list endpoint EXCEPT message history,
 * which uses cursor/keyset pagination instead (services/message.service.ts).
 * See architecture doc §1.5 for the rationale behind having two standards.
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  q?: string;
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export function parsePaginationQuery(query: Record<string, unknown>): PaginationParams {
  const page = query.page ? Number(query.page) : undefined;
  const pageSize = query.pageSize ? Number(query.pageSize) : undefined;
  const sort = typeof query.sort === 'string' ? query.sort : undefined;
  const order = query.order === 'DESC' || query.order === 'desc' ? 'DESC' : query.order ? 'ASC' : undefined;
  const q = typeof query.q === 'string' ? query.q : undefined;
  return { page, pageSize, sort, order, q };
}

export async function paginate<M extends Model>(
  model: ModelStatic<M>,
  params: PaginationParams,
  options: FindOptions<Record<string, unknown>> = {},
  defaultSort: string = 'createdAt',
): Promise<{ items: M[]; meta: PaginationMeta }> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(params.pageSize ?? DEFAULT_PAGE_SIZE)));

  // Defense in depth: every list route is expected to whitelist `sort` in
  // its own express-validator chain (isIn([...allowedColumns])), but a
  // route that forgets to would otherwise hand an arbitrary string straight
  // to Sequelize's `order`, which turns into a raw Postgres 500 for any
  // non-column value instead of a clean 400. Reject anything that isn't a
  // real attribute on the model being queried.
  if (params.sort && !(params.sort in model.getAttributes())) {
    throw new BadRequestError(`Unknown sort field: "${params.sort}"`);
  }

  const order: Order = params.sort ? [[params.sort, params.order ?? 'ASC']] : [[defaultSort, params.order ?? 'DESC']];

  const { rows, count } = await model.findAndCountAll({
    ...options,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order,
    distinct: true,
  });

  return {
    items: rows,
    meta: {
      page,
      pageSize,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / pageSize)),
    },
  };
}

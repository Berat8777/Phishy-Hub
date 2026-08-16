import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller';
import * as ticketCommentController from '../controllers/ticketComment.controller';
import {
  ticketIdParamValidator,
  listTicketsValidator,
  createTicketValidator,
  updateTicketValidator,
  assignTicketValidator,
  updateTicketStatusValidator,
} from '../validators/ticket.validator';
import {
  listTicketCommentsValidator,
  createTicketCommentValidator,
  updateTicketCommentValidator,
  ticketCommentIdParamValidator,
} from '../validators/ticketComment.validator';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', listTicketsValidator, ticketController.list);
router.post('/', createTicketValidator, ticketController.create);
router.get('/:id', ticketIdParamValidator, ticketController.getById);
router.patch('/:id', updateTicketValidator, ticketController.update);
router.delete('/:id', ticketIdParamValidator, ticketController.remove);
router.post('/:id/assign', assignTicketValidator, ticketController.assign);
router.post('/:id/status', updateTicketStatusValidator, ticketController.updateStatus);

router.get('/:id/comments', listTicketCommentsValidator, ticketCommentController.list);
router.post('/:id/comments', createTicketCommentValidator, ticketCommentController.create);
router.patch('/:id/comments/:commentId', updateTicketCommentValidator, ticketCommentController.update);
router.delete('/:id/comments/:commentId', ticketCommentIdParamValidator, ticketCommentController.remove);

export default router;

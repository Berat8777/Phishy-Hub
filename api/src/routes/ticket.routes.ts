import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller';
import {
  ticketIdParamValidator,
  listTicketsValidator,
  createTicketValidator,
  updateTicketValidator,
  assignTicketValidator,
  updateTicketStatusValidator,
} from '../validators/ticket.validator';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', listTicketsValidator, ticketController.list);
router.post('/', createTicketValidator, ticketController.create);
router.get('/:id', ticketIdParamValidator, ticketController.getById);
router.patch('/:id', updateTicketValidator, ticketController.update);
router.post('/:id/assign', assignTicketValidator, ticketController.assign);
router.post('/:id/status', updateTicketStatusValidator, ticketController.updateStatus);

export default router;

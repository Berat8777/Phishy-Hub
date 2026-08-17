import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import departmentRoutes from './department.routes';
import channelRoutes from './channel.routes';
import messageRoutes from './message.routes';
import fileRoutes from './file.routes';
import leaveRequestRoutes from './leaveRequest.routes';
import leaveCalendarRoutes from './leaveCalendar.routes';
import ticketRoutes from './ticket.routes';
import meetingRoutes from './meeting.routes';
import notificationRoutes from './notification.routes';
import aiRoutes from './ai.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/departments', departmentRoutes);
router.use('/channels', channelRoutes);
router.use('/', messageRoutes); // mounts /channels/:channelId/messages + /messages/:id
router.use('/files', fileRoutes);
router.use('/leave-requests', leaveRequestRoutes);
router.use('/leave-calendar', leaveCalendarRoutes);
router.use('/tickets', ticketRoutes);
router.use('/meetings', meetingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);

export default router;

// src/routes/events.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { streamEvents, getEvents, acknowledgeEvent, acknowledgeAll, getEventStats } from '../controllers/events.controller';

const router = Router();

// SSE stream — no auth middleware (uses query token or open stream)
router.get('/stream', streamEvents);

// REST
router.use(authenticate);
router.get('/',          getEvents);
router.get('/stats',     getEventStats);
router.patch('/:id/ack', acknowledgeEvent);
router.post('/ack-all',  acknowledgeAll);

export default router;

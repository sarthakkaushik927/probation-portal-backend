import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as SubmissionController from '../controllers/submission.controller';

const router = Router();

router.use(authenticate);

// Comments
router.get('/:submissionId/comments', SubmissionController.getComments);
router.post('/:submissionId/comments', SubmissionController.addComment);

export default router;

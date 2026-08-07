import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as AdminController from '../controllers/admin.controller';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/dashboard', AdminController.getDashboard);

router.get('/users', AdminController.getUsers);
router.get('/users/:userId', AdminController.getUser);
router.patch('/users/:userId/domain', AdminController.updateDomain);
router.delete('/users/:userId', AdminController.deleteUser);

router.get('/tasks', AdminController.getTasks);
router.post('/tasks', AdminController.createTask);
router.patch('/tasks/:taskId', AdminController.updateTask);

router.get('/submissions', AdminController.getSubmissions);
router.get('/submissions/:submissionId', AdminController.getSubmission);
router.patch('/submissions/:submissionId/approve', AdminController.approveSubmission);
router.patch('/submissions/:submissionId/reject', AdminController.rejectSubmission);

router.get('/attendance', AdminController.getAttendanceUsers);
router.post('/attendance', AdminController.saveAttendance);

// Export CSV
router.get('/export/attendance', AdminController.exportAttendanceCSV);
router.get('/export/submissions', AdminController.exportSubmissionsCSV);
router.get('/export/users', AdminController.exportUsersCSV);
router.get('/export/users/:userId', AdminController.exportUserDataCSV);

export default router;

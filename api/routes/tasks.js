import { Router } from 'express'
import taskController from '../controllers/taskController.js'
import { isLoggedIn, isEnabled, isUploader, isPathologist, asyncHandler } from '../lib/functions.js' // Helper functions

const router = Router()

const isValid = [isLoggedIn, isEnabled, isUploader]
const isObserver = [isLoggedIn, isEnabled, isPathologist]

// routes for /tasks
router.get('/', isObserver, asyncHandler(taskController.getAllTasks))
router.get('/owned', isValid, asyncHandler(taskController.getOwnedTasks))
router.get('/table', isValid, asyncHandler(taskController.getTaskTable))
router.get('/progress', isValid, asyncHandler(taskController.getTaskProgress))
router.post('/', isValid, asyncHandler(taskController.createTask))
router.post('/update', isValid, asyncHandler(taskController.updateTask))
router.post('/delete', isValid, asyncHandler(taskController.deleteTask))
router.get('/observers', isValid, asyncHandler(taskController.getObservers))
router.post('/observers', isValid, asyncHandler(taskController.updateObservers))
router.get('/images', isValid, asyncHandler(taskController.getImages))
router.post('/images', isValid, asyncHandler(taskController.setTaskImages))
router.get('/export', isValid, asyncHandler(taskController.exportTaskById))
router.get('/:taskId/guide', isObserver, asyncHandler(taskController.getTaskGuide))
router.post('/:taskId/guide', isValid, asyncHandler(taskController.saveTaskGuide))

export default router
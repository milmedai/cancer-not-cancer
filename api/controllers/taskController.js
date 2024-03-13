import dataOps from '../dbOperations/dataOps.js'
import taskOps from '../dbOperations/taskOps.js'
import { virtualFileSystem as VFS } from '../lib/functions.js'

const taskController = {
    //** Returns all task assigned to the user/observer. */
    async getAllTasks (req, res, next) {
        let observerId = req.user.id
        const data = await taskOps.getTasked(observerId)
        res.send(data)
    },
    /** Returns all tasks owned/associated with a user id. Admins can change user id. */
    async getOwnedTasks (req, res) {
        let investigatorId = req.user.id
        if (req.query.user_id && req.user.permissions.admin) {
            investigatorId = req.query.user_id
        }
        const data = await taskOps.getTasks(investigatorId)
        res.send(data)
    },
    /** Returns all data needed to build a task table associated with a user id. */
    async getTaskTable (req, res) {
        let investigatorId = req.user.id
        const data = await taskOps.getTaskTable(investigatorId)
        res.send(data)
    },
    /** Returns an individual task's progress, for updating the getTaskTable data. */
    async getTaskProgress (req, res) {
        let investigatorId = req.user.id
        const taskId = req.query.task_id
        const data = await taskOps.getQuickTaskProgress(investigatorId, taskId)
        res.send(data)
    },
    /** Handle a post request to create a new task. Returns new task id. */
    async createTask (req, res) {
        let investigatorId = req.user.id
        const short_name = req.body.short_name
        const prompt = req.body.prompt
        console.log('CreateTask::', short_name, prompt)

        const insertId = await taskOps.createTask(investigatorId, short_name, prompt)
        res.send({ newTaskId: insertId })
    },
    /** Handle a post request to update a task.  */
    async updateTask (req, res) {
        let investigatorId = req.user.id
        const taskId = req.body.id
        const short_name = req.body.short_name
        const prompt = req.body.prompt
        const chip_size = req.body.chip_size || null
        const fov_size = req.body.fov_size || null
        const zoom_scale = req.body.zoom_scale || null
        await taskOps.updateTask(investigatorId, taskId, short_name, prompt, chip_size, fov_size, zoom_scale)

        res.sendStatus(200)
    },
    /** Handle a post request to delete a task. */
    async deleteTask (req, res) {
        let investigatorId = req.user.id
        const taskId = req.body.id
        await taskOps.deleteTask(investigatorId, taskId)
        res.sendStatus(200)
    },
    /** Handle a get request for a tasks observers(users). */
    async getObservers (req, res, next) {
        let investigatorId = req.user.id
        const taskId = req.query.task_id
        const observers = await taskOps.getObservers(investigatorId, taskId)
        res.send(observers)
    },
    /** Update/Set observers for a task id. */
    async updateObservers (req, res) {
        let investigatorId = req.user.id
        const taskId = req.body.task_id
        const observerIds = JSON.parse(req.body.observerIds)
        await taskOps.updateObservers(investigatorId, taskId, observerIds)
        res.sendStatus(200)
    },
    /** Get images and tag/folder structure for task image assignment. */
    async getImages (req, res) {
        let investigatorId = req.user.id
        const taskId = req.query.task_id

        const images = await taskOps.getImages(investigatorId, taskId)

        // build file structure
        const folderMap = new Map() // keep track of all folders
        const topAncestorFolders = new Set() // keep track of the top most folders
        const folderContents = new Map() // used to keep track of all folder's content
        for (const image of images) {
            // Find or create an images containing folders
            // -------------------------------------------
            const tagId = image['tag_id'] // containing folder id
            const parentTagId = image['parent_tag_id'] // containing folder's parent folder id

            // has the containing folder been created before?
            if (!folderMap.has(tagId)) {
                // NO --> lets create the folder and keep track of it and it's contents
                folderMap.set(tagId, VFS.createFolder(tagId, image['tag_name']))
                folderContents.set(tagId, new Set())
            }

            // get the containing folder object
            const folder = folderMap.get(tagId)

            // does the containing folder have a parent folder?
            if (parentTagId !== null) {
                // YES -> has the containing folder's parent folder been created?
                if (!folderMap.has(parentTagId)) {
                    // NO -> lets create it and keep track of it and it's contents
                    folderMap.set(parentTagId, VFS.createFolder(parentTagId, image['parent_tag_name']))
                    folderContents.set(parentTagId, new Set())
                }

                // get the contianing folder's parent folder and contents
                const parentFolder = folderMap.get(parentTagId)
                const parentFolderContents = folderContents.get(parentTagId)

                // does the containing folder's parent folder already contain the containing folder?
                if (!parentFolderContents.has(folder)) {
                    // NO -> lets add it to the parent folder and keep track of it
                    parentFolder.contents.push(folder)
                    parentFolderContents.add(folder)
                }
            } else {
                // NO -> containing folder doesn't have a parent folder meaning it is a topAncestorFolder
                topAncestorFolders.add(folder)
            }

            // With all the folders managed, we can add the image to it's containing folder
            // ----------------------------------------------------------------------------
            
            // is this image actually an image?
            if (image['image_id'] !== null) {
                // Yes -> create a file object and add it to the containing folder
                const file = VFS.createFile(image['image_id'], image['original_name'], !!image['selected'])
                folder.contents.push(file)
            }
        }

        // Since the folders containing eachother heirachically we only need to
        // return the topAncestorFolders(the folders with no parents)
        const fileArray = Array.from(topAncestorFolders)
        res.send(fileArray)
    },
    /** Assign select images to a task. */
    async setTaskImages(req, res) {
        let investigatorId = req.user.id
        const taskId = req.body.task_id
        const imageIds = JSON.parse(req.body.imageIds)
        await taskOps.setTaskImages(investigatorId, taskId, imageIds)
        res.sendStatus(200)
    },
    /** Export task as JSON */
    async exportTaskById(req, res) {
        let investigatorId = req.user.id
        const taskId = req.query.id
        console.log(`Gathering data for task ${taskId}, by user: ${investigatorId}`)
        const results = await dataOps.getDataExportByTaskId(investigatorId, taskId)
        res.send(results)
    },

    async getTaskGuide(req, res) {
        const taskId = req.params.taskId
        const guide = await taskOps.getTaskGuide(taskId)
        let content = ''
        if (guide) content = guide.content
        res.send(content)
    },
    async saveTaskGuide(req, res) {
        let investigatorId = req.user.id
        const taskId = req.params.taskId
        const content = req.body.content
        taskOps.setTaskGuide(taskId, content)
        res.sendStatus(200)
    }
}

export default taskController
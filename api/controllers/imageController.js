import { Router } from 'express'
import imageOps from '../dbOperations/imageOps.js'
import tagOps from '../dbOperations/tagOps.js'
import { isMultipart, uploadImages, uploadAnnotationImages, removeFile, removeEmptyImageFolders } from '../lib/upload.js' // middleware to handle uploads
import { getIP, virtualFileSystem as VFS, asyncHandler } from '../lib/functions.js' // Helper functions

import * as path from 'path'

const imageBaseURL = process.env.IMAGE_URL
const annotationImageFolderName = 'Annotation Guides'

const folderQueue = {}

/** Express.js API endpoint handlers for image related requests. */
const imageController = {
    /**
     * Asynchronously retrieves the next image url based on the provided imageId.
     *
     * @param {express.Request} req - The Express request object.
     * @param {express.Response} res - The Express response object.
     * @param {express.NextFunction} next - The Express next function for error handling.
     * @returns {Promise<void>} A Promise that resolves when the operation is complete.
     * @throws {Error} If an error occurs while retrieving the next image.
     */
    async nextImage(req, res, next) {
        let imageId = req.query.imageId
        console.log("GET: nextImage", imageId);

        const img = await imageOps.getNextImage(imageId)
                const pathUrl = new URL(img.path, imageBaseURL)
        
        res.send({
            id: img.id, // imageID
            url: pathUrl.href
        })
    },
    
    /** Retrieve a queue of next image ids for grading based on taskId. */
    async getNextImageIds(req, res, next) {
        let userId = req.user.id
        let taskId = req.query.taskId
        const data = await imageOps.getNextImageIds(userId, taskId)
        res.send(data)
    },

    async getImageQueue(req, res, next) {
        let taskId = req.params.taskId
        let userId = req.user.id
        const data = await imageOps.getImageQueue(userId, taskId)
        const imageQueue = data.map(row => { return {...row, imageUrl: new URL(row.imageUrl, imageBaseURL).href}})

        res.send(imageQueue)
    },
    
    async setSlideMasterFolder(req, res, next) {
        const date = new Date(req.headers.uploadtime)
        const masterFolderName = `${date.toISOString().split('.')[0].replace('T', ' ')} Upload`
        req.masterFolderName = masterFolderName
        next()
    },

    async setAnnotationsMasterFolder(req, res, next) {
        req.masterFolderName = annotationImageFolderName
        next()
    },

    /** Save successfull image uploads with the uploaders ip */
    async saveUploadsToDb(req, res, next) {
        // TODO: this has no error handling if the req has ended... will cause getIP to throw an error.
        const ip = getIP(req)
        const masterFolderName = req.masterFolderName

        const folderKey = `${req.user.id}_${masterFolderName}`
        const folderStructure = VFS.createFolderStructure(req.files, masterFolderName)
        
        try {
            let existingFolders = folderQueue[folderKey] || {}

            if (masterFolderName == annotationImageFolderName && Object.keys(existingFolders).length === 0) {
                // attempt to find folder/tags
                existingFolders = await imageOps.retrieveExistingFolders(req.user.id, annotationImageFolderName)
            }

            // create additional folders here
            const folders = await imageOps.saveFolderStructure(folderStructure, req.user.id, existingFolders)
            folderQueue[folderKey] = folders

            for (const file of req.files) {
                if (file.success) {
                    try {
                        
                        let location = file.sanitizedName.split(path.sep)
                        const originalFileName = location.pop()
                        const folderName = path.join(masterFolderName, ...location)
                        const folderId = folders[folderName]['id']
                        
                        const insertImageSuccess = await imageOps.addImage(
                            file.relPath, // safe: created by the server
                            file.hash || null, // file contents hash
                            ip,
                            req.user.id,
                            originalFileName,
                            folderId
                        )
                            
                        if (!insertImageSuccess) {
                            console.log('File already exists:', file.sanitizedName)
                            file.success = false
                            file.message = 'File already exists.'
                        }
                    } catch (err) {
                            // database error
                            console.error(err)
                            file.success = false
                            file.message = 'Upload Error. Please try again later.'
                    }
                }
            }
            
        } catch (error) {
            // TODO: delete files that have been uploaded
            next(error) // Pass error on to unified error handler.
        }
        
        if (req.headers.finalblock) {
            console.log('FINAL BLOCK, deleting folderQueue entry.')
            delete folderQueue[folderKey]
        }

        // TODO: if a file upload fails and there are no files associated with the
        // folder, then we should delete the folder
        next()
    },
        
    /** If an image database save wasn't successful, we want to remove the file. */
    async removeFailedImageSaves(req, res, next) {
        for (const file of req.files) {
            if (!file.success) {
                await removeFile(file.savePath)
            }
        }
        removeEmptyImageFolders()
        next()
    },
        
    /** Delete a file at the relative file path.
     * @param {String} filePath - should be relative with filename and extension.
     */
    async deleteFile(filePath) {
        const absoluteFilePath = path.join(process.env.IMAGES_DIR, filePath)
        await removeFile(absoluteFilePath)
        removeEmptyImageFolders()
    },

    /** Delete files at the relative file path.
     * @param {Array<String>} filePaths - should be relative with filename and extension.
     */
    async deleteFiles(filePaths) {
        const absoluteFilePaths = filePaths.map((filePath) => path.join(process.env.IMAGES_DIR, filePath))
        await Promise.all(absoluteFilePaths.map((absFilePath) => removeFile(absFilePath)))
        removeEmptyImageFolders()
    },
        
    /** Filters file upload output to relevant data only (Return to sender the
     * status of the upload). */
    async saveImages(req, res, next) {
        if (req.files.length === 0) {
            res.status(200).send('No files uploaded.')
        } else {
            const allowedKeys = ["filename", "mimeType", "id", "relPath", "imageUrl", "success", "message"]    
            const resultData = req.files.map((file) => {
                const filteredFile = Object.keys(file)
                .filter(key => allowedKeys.includes(key))
                .reduce((obj, key) => {
                    obj[key] = file[key]
                    return obj
                }, {})
                return filteredFile
            })
            
            res.status(200).send(resultData)
        }
    },
    /** Rename a file based on file id and owner(investigator) id. */
    async renameImage(req, res, next) {
        const investigatorId = req.user.id
        const imageId = req.body.imageId
        const newName = req.body.newName
        console.log('renameImage:: User:', investigatorId, 'imageId:', imageId, 'newName:', newName)
        
        await imageOps.renameImage(imageId, newName, investigatorId)
        res.sendStatus(200)
    },
    /** Move image to a different folder/tag. This is virtual and doesn't
     * actually move the file on the file system.
     */
    async moveImage(req, res, next) {
        const investigatorId = req.user.id
        const imageId = req.body.imageId
        const oldParentTagId = req.body.oldParentTagId
        const newParentTagId = req.body.newParentTagId
        console.log('moveImage:: User:', investigatorId, 'imageId:', imageId, 'newParentTagId:', newParentTagId)
        
        await imageOps.moveImage(imageId, oldParentTagId, newParentTagId, investigatorId)
        res.sendStatus(200)
    },
    /** Delete image from file system, then removes image from database. */
    async deleteImage(req, res, next) {
        const investigatorId = req.user.id
        const imageId = req.body.imageId
        console.log('deleteImage:: User:', investigatorId, 'imageId:', imageId)
        
        const img = await imageOps.getNextImage(imageId)
        await imageController.deleteFile(img.path)
        await imageOps.deleteImage(imageId, investigatorId)
        res.sendStatus(200)
    },
    /** Create a tag/folder. */
    async createTag(req, res, next) {
        const investigatorId = req.user.id
        const tagName = req.body.tagName
        if (tagName === '') {
            // A tag name must be provided.
            res.sendStatus(400)
        } else {
            console.log('CreateTag:: User:', investigatorId, 'tagName:', tagName)
            
            const newTagId = await tagOps.createTag(tagName, investigatorId)
            const newFolder = VFS.createFolder(newTagId, tagName)
            res.send(newFolder)
        }
    },
    /** Rename a tag/folder name. */
    async updateTag(req, res, next) {
        const investigatorId = req.user.id
        const tagId = req.body.tagId
        const tagName = req.body.tagName
        console.log('UpdateTag:: User:', investigatorId, 'tagId:', tagId, 'tagName:', tagName)
        
        await tagOps.renameTag(tagId, tagName, investigatorId)
        res.sendStatus(200)
    },
    /** Remove a tag's previous parent and assign a new parent. */
    async moveTag(req, res, next) {
        const investigatorId = req.user.id
        const tagId = req.body.tagId
        const oldParentTagId = req.body.oldParentTagId
        const newParentTagId = req.body.newParentTagId
        console.log('MoveTag:: User:', investigatorId, 'tagId:', tagId, 'parentTagId:', newParentTagId)
        
        await tagOps.moveTag(tagId, oldParentTagId, newParentTagId)
        res.sendStatus(200)
    },
    // TODO: Make sure the tag has no images associated with it before deleteing.
    // This is done on the frontend, but should really be done here too.
    /** Delete a tag. */
    async deleteTag(req, res, next) {
        const investigatorId = req.user.id
        const tagId = req.body.tagId        
        console.log('DeleteTag:: User:', investigatorId, 'tagId:', tagId)

        const success = await tagOps.deleteTag(tagId, investigatorId)
        if (success) {
            res.sendStatus(200)
        } else {
            // tag not deleted, probably because there was other images or tags dependent on the tag
            console.log('DeleteTag - FAILED')
            res.sendStatus(400)
        }
    },
    /** Delete a list of images and tags. */
    async deleteAllContentsIn(req, res, next) {
        const investigatorId = req.user.id
        const tags = req.body.tags
        const images = req.body.images
        console.log('DeleteAllContentsIn:: User:', investigatorId)
        console.log('images:', images)
        console.log('tags:', tags)

        const imgPaths = await imageOps.getPaths(images)
        await imageController.deleteFiles(imgPaths)
        await imageOps.deleteImages(images, investigatorId)
        await tagOps.deleteTags(tags, investigatorId)

        res.sendStatus(200)
        
    },
    /**
     * Middleware for uploading and saving images.
     * @type {Router}
     * @memberof imageController
     */
    uploadAndSaveImages: null
}

// Join all the middleware pieces need for uploading images.
// This list is order specific.
imageController.uploadAndSaveImages = Router().use([
    asyncHandler(isMultipart),
    asyncHandler(uploadImages),
    asyncHandler(imageController.setSlideMasterFolder),
    asyncHandler(imageController.saveUploadsToDb),
    asyncHandler(imageController.removeFailedImageSaves),
    asyncHandler(imageController.saveImages)
])

// This list is order specific.
imageController.uploadAndSaveAnnotationImages = Router().use([
    asyncHandler(isMultipart),
    asyncHandler(uploadAnnotationImages),
    asyncHandler(imageController.setAnnotationsMasterFolder),
    asyncHandler(imageController.saveUploadsToDb),
    asyncHandler(imageController.removeFailedImageSaves),
    asyncHandler(imageController.saveImages)
])

export default imageController
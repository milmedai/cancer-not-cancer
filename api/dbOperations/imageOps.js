import dbOps from "./dbConnection.js"
import * as path from 'path'

// ---------------------------------
// IMAGE BASED DATABASE METHODS
// ---------------------------------
/**
 * @typedef {Object} ImageObject
 * @property {string} path - Local image path on server.
 * @property {string} hash - File check some hash, nullable, sha256.
 * @property {date} date_added - Date image was uploaded.
 * @property {string} from_ip - IP address of uploaded.
 * @property {string} user_id - Uploaders user id (owner).
 * @property {string} times_graded - Number of times the image has been graded.
 * @property {string} original_name - Original file name, used for display but
 * not the actual file name which is in the path.
 */
const imageOps = {
    /**
     * Get image object by id.
     * @param {number} imageId - Image's id to look up.
     * @returns {ImageObject} - ImageObject which contains `path` and `original_name`.
     */
    async getNextImage(imageId) {
        const query = `SELECT id, path FROM images WHERE images.id = ?`
        const rows = await dbOps.select(query, [imageId])
        return rows[0]
    },

    /**
     * Get list of image paths.
     * @param {Array} imageIds - Image ids to look up.
     * @returns {Array<String>} - [imagePath] - list of image paths.
     */
    async getPaths(imageIds) {
        if (imageIds.length === 0) {
            return []
        }
        const imagePlaceholders = Array.from(Array(imageIds.length), () => '?').join(', ')
        const query = `SELECT path FROM images WHERE images.id IN (${imagePlaceholders})`
        const rows = await dbOps.select(query, imageIds)
        return rows.map(x => x.path)
    },

    /**
     * Database call that returns a queue of next images to be graded.
     * @param {Number} userId - User's id to check against existing ratings
     * @param {Number} taskId - Task id for which to build the queue of image ids.
     * @returns {Array.<Number>} - Returns an array of image id numbers.
     */
    async getNextImageIds(userId, taskId) {
        const query = `
            (
                SELECT task_images.image_id as image_id
                FROM task_images 
                WHERE task_images.task_id = ?
            )
            EXCEPT
            (
                SELECT hotornot.image_id as image_id
                FROM hotornot
                WHERE user_id = ? AND task_id = ?
            )`
        const rows = await dbOps.select(query, [taskId, userId, taskId])
        return rows.map(row => row.image_id)
    },

    async getImageQueue(userId, taskId) {
        const limit = 25
        const query = `
            WITH
                HotOrNotQuick AS (
                    SELECT hotornot.image_id as image_id
                    FROM hotornot
                    WHERE
                    user_id = ?
                    AND task_id = ?
                )
                SELECT
                    images.id as image_id,
                    images.path as imageUrl,
                    images.original_name as name
                FROM task_images
                LEFT JOIN images ON task_images.image_id = images.id
                WHERE
                    task_images.task_id = ?
                    AND task_images.image_id NOT IN(SELECT image_id FROM HotOrNotQuick)
                LIMIT ?`

        const rows = await dbOps.select(query, [userId, taskId, taskId, limit])
        return rows
    },

    async retrieveExistingFolders(user_id, parentFolderName) {
        const getFolderStructureChildToParent = `
            WITH RECURSIVE rel as (
                SELECT tags.id, tags.name, tags.user_id, tag_relations.parent_tag_id as parent_id
                FROM tags
                LEFT JOIN tag_relations on tags.id = tag_relations.tag_id
                WHERE tags.name = ? AND tags.user_id = ?
                    UNION ALL
                SELECT t.id, t.name, t.user_id, tr.parent_tag_id as parent_id
                FROM tags t
                LEFT JOIN tag_relations tr ON tr.tag_id = t.id
                INNER JOIN rel ON tr.parent_tag_id = rel.id
            )
            SELECT * from rel`

        // raw tag/folder structure [{id, name, user_id, parent_id}]
        const rows = await dbOps.select(getFolderStructureChildToParent, [parentFolderName, user_id])

        // map for direct access to each tag/folder
        const folderMap = rows.reduce((fMap, row) => {
            fMap[row.id] = { ...row, children: [] }
            return fMap
        }, {})

        // organize folders into a tree
        let root = null
        rows.forEach(row => {
            if (row.parent_id !== null) {
                folderMap[row.parent_id].children.push(folderMap[row.id])
            } else {
                // root found
                root = folderMap[row.id]
            }
        })

        // recusive builds the paths for all the decending nodes
        function buildPaths(node, currentPath = '') {
            if (!node) return
            const path = `${currentPath}/${node.name}`.replace(/^\//, '') // remove leading slash
            foundFolders[path] = {
                name: path,
                id: node.id,
                parentFolderName: currentPath
            }
            node.children.forEach(child => buildPaths(child, path))
        }

        const foundFolders = {}
        if (root) {
            buildPaths(root)
        }

        return foundFolders

    },
    /**
     * Translates an array or set of folder paths into tag and creates tag relations accordingly.
     * 
     * folders are saved as tags in the database, and a tag can have parent tags (a tag_relation)
     * folderStructure should be an array of every folder's full path
     * ex. folders: root -> subFolder === ['root/subFolder', 'root']
     * @param {Set.<String>} folderStructure - Iterable of strings representing folder paths.
     * @param {Number} user_id - The id of the owner of the folders (the investigator).
     * @returns {Object} - Object of all folders created with the folders path as the key
     * and { name, id, and parentFolderName}.
     */
    async saveFolderStructure(folderStructure, user_id, folders = {}) {
        const createFolderTag = `INSERT INTO tags (name, user_id) VALUES (?, ?)`
        const createTagRelation = `INSERT INTO tag_relations (tag_id, parent_tag_id) VALUES (?, ?)`

        const newFolders = {}
        // first we iterate through and create all the folders/tags
        for (const folderPath of folderStructure) {
            if (folderPath in folders) {
                continue
            }

            let folderArray = folderPath.split(path.sep)
            const folderName = folderArray.pop()
            const parentFolderName = folderArray.join(path.sep)

            const results = await dbOps.executeWithResults(createFolderTag, [folderName, user_id])
            // save new folder/tag id for reference later
            folders[folderPath] = {
                'name': folderPath,
                'id': results.insertId,
                'parentFolderName': parentFolderName
            }

            newFolders[folderPath] = {
                'name': folderPath,
                'id': results.insertId,
                'parentFolderName': parentFolderName
            }
        }

        // now we create a relation for each folder with a parent folder
        for (const folder of Object.values(newFolders)) {
            if (folder.parentFolderName !== '') {
                // add parent relationship
                const parentFolder = folders[folder.parentFolderName]
                await dbOps.execute(createTagRelation, [folder.id, parentFolder.id])
            }
        }

        return folders
    },

    /**
     * Add image to database
     * @param {String} path - Relative path to file on server includes filename.
     * @param {String} hash - File check some hash, sha256.
     * @param {String} from_ip - Uploaders ip address.
     * @param {Number} user_id - Uploaders user id (owner of the image).
     * @param {String} original_name - Original file name.
     * @param {Number} folderId - Folder/tag id that the image should be associated with.
     * @returns {Boolean} - Returns true if successfull, false if duplicate.
     */
    async addImage(path, hash, from_ip, user_id, original_name, folderId) {
        // its critical that we associate the images with a tag/folder, otherwise the frontend won't see the image
        const addImageQuery = `INSERT INTO images (path, hash, from_ip, user_id, original_name) VALUES (?, ?, ?, ?, ?)`
        const addImageToTag = `INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)`

        try {
            const transaction = await dbOps.startTransaction()
            const results = await transaction.query(addImageQuery, [path, hash, from_ip, user_id, original_name])
            await transaction.query(addImageToTag, [results.insertId, folderId])
            await transaction.commit()
            console.log(`Successful image insert query: ${path}`);
            return true
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // duplicate image insert
                return false
            } else {
                console.error('Error saving image to database.')
                throw (err)
            }
        }
    },

    /**
     * Rename a file.
     * @param {Number} imageId - ID of image to rename
     * @param {String} newName - New name of file.
     * @param {Number} user_id - User/owner's id of image.
     */
    async renameImage(imageId, newName, user_id) {
        const renameImage = `UPDATE images SET original_name = ? WHERE id = ? AND user_id = ?`
        await dbOps.execute(renameImage, [newName, imageId, user_id])
    },
    /**
     * Move file to different folder/tag.
     * @param {Number} imageId - ID of image to move
     * @param {Number} oldParentTagId - ID of original folder/tag location.
     * @param {Number} newParentTagId - ID of new folder/tag location.
     * @param {Number} user_id - User/owner's id of image.
     */
    async moveImage(imageId, oldParentTagId, newParentTagId, user_id) {
        const deleteImageTags = `DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?`
        const tagImage = `INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)`

        const transaction = await dbOps.startTransaction()
        await transaction.query(deleteImageTags, [imageId, oldParentTagId])
        await transaction.query(tagImage, [imageId, newParentTagId])
        await transaction.commit()
    },
    /**
     * Delete file
     * @param {Number} imageId - ID of image to delete.
     * @param {Number} user_id - User/owner's id of image.
     */
    async deleteImage(imageId, user_id) {
        const deleteImage = `DELETE FROM images WHERE id = ? AND user_id = ?`
        // TODO: WARNING: deleting a photo will delete the photo from the task,
        // this is not obvious in the UI to the investigator and cause DAMAGE!
        const deleteImageFromTasks = `DELETE FROM task_images WHERE image_id = ?`

        // TODO: Delete reference in image_tags too.
        await dbOps.execute(deleteImage, [imageId, user_id])
        await dbOps.execute(deleteImageFromTasks, [imageId])
    },
    /**
     * Delete list of files
     * @param {Number} imageIds - IDs of images to delete.
     * @param {Number} user_id - User/owner's id of image.
     */
    async deleteImages(imageIds, user_id) {
        console.log('deleteImages', imageIds)

        if (imageIds.length === 0) {
            console.log('no images to delete')
            return
        }

        const imagePlaceholders = Array.from(Array(imageIds.length), () => '?').join(', ')
        const deleteImage = `DELETE FROM images WHERE id IN (${imagePlaceholders}) AND user_id = ?`
        // TODO: WARNING: deleting a photo will delete the photo from the task,
        // this is not obvious in the UI to the investigator and cause DAMAGE!
        const deleteImageFromTasks = `DELETE FROM task_images WHERE image_id IN (${imagePlaceholders})`

        // TODO: Delete reference in image_tags too.
        await dbOps.execute(deleteImage, [...imageIds, user_id])
        await dbOps.execute(deleteImageFromTasks, imageIds)
    }
}


export default imageOps
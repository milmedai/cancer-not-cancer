import dbOps from "./dbConnection.js"
import * as path from 'path'

// ---------------------------------
// DATA BASED DATABASE METHODS
// ---------------------------------
const dataOps = {
    /**
     * Add a grading/rating for an image in a task.
     * @param {Number} userId - Id of user making the grading.
     * @param {Number} imageId - Id of image being graded/rated.
     * @param {Number} rating - Grading value {-1, 0, 1} No, Maybe, Yes.
     * @param {String} comment - Any additional comment the user adds.
     * @param {String} fromIp - Ip address of the user making the grading.
     * @param {Number} taskId - The task id of the prompt associated with the grading.
     */
    async addRating(userId, imageId, rating, comment, fromIp, taskId) {
        // Note: for addRating, technically updateQuery is not necessary anymore
        const ratingQuery = `INSERT INTO hotornot (user_id, image_id, rating, comment, from_ip, task_id) 
            VALUES (?, ?, ?, ?, ?, ?)`
        const updateQuery = `UPDATE images 
            SET times_graded = times_graded + 1 
            WHERE id = ?;`
        
        const transaction = await dbOps.startTransaction()
        await transaction.query(ratingQuery, [userId, imageId, rating, comment, fromIp, taskId])
        await transaction.query(updateQuery, [imageId])
        await transaction.commit()
        console.log("Successful hotornot insert query");
    },
    

    /**
     * Overview data: totals for all tasks or a specified task
     * @param {Number} userId - Id of investigator associated with task data.
     * @param {Number} taskId - Task id to look up data for.
     * @returns {Object} - Rating counts: {total, yes, no, maybe}
     */
    async getData(userId, taskId) {
        const query = `SELECT
                        count(*) AS total,
                        sum(case when rating = 1 then 1 else 0 end) AS yes,
                        sum(case when rating = -1 then 1 else 0 end) AS no,
                        sum(case when rating = 0 then 1 else 0 end) AS maybe
                    FROM hotornot
                        LEFT JOIN tasks ON hotornot.task_id = tasks.id
                    WHERE (task_id = ? OR ? is NULL)
                        AND tasks.investigator = ?`
        const rows = await dbOps.select(query, [taskId, taskId, userId])
        
        return rows[0]
    },

    /**
     * Similar to getData, but totals are split by each user associated.
     * @param {Number} userId - Id of investigator
     * @param {Number} taskId - Id of task associated with data
     * @returns {Array.<Object>} - Counts per user [{user_id, fullname, total, yes, no, maybe}]
     */
    async getDataPerUsers(userId, taskId) {
        const query = `
            SELECT
                h.user_id,
                u.fullname,
                COUNT(*) AS total,
                SUM(CASE WHEN h.rating = 1 THEN 1 ELSE 0 END) AS yes,
                SUM(CASE WHEN h.rating = -1 THEN 1 ELSE 0 END) AS no,
                SUM(CASE WHEN h.rating = 0 THEN 1 ELSE 0 END) AS maybe
            FROM
                hotornot as h
            LEFT JOIN users as u ON
                h.user_id = u.id
            LEFT JOIN tasks ON h.task_id = tasks.id
            WHERE (task_id = ? OR ? is NULL)
                AND tasks.investigator = ?
            GROUP BY
                h.user_id`

        const rows = await dbOps.select(query, [taskId, taskId, userId])
        return rows
    },

    /**
     * Similar to getData, but totals are split by each image associated.
     * @param {Number} userId - Id of investigator
     * @param {Number} taskId - Id of task associated with data
     * @returns {Array.<Object>} - Counts per image [{image_id, path, total, yes, no, maybe}]
     */
    async getDataPerImages(userId, taskId) {
        const query = `
            SELECT
                h.image_id,
                im.path,
                COUNT(*) AS total,
                SUM(CASE WHEN h.rating = 1 THEN 1 ELSE 0 END) AS yes,
                SUM(CASE WHEN h.rating = -1 THEN 1 ELSE 0 END) AS no,
                SUM(CASE WHEN h.rating = 0 THEN 1 ELSE 0 END) AS maybe
            FROM
                hotornot as h
            LEFT JOIN images as im ON
                h.image_id = im.id
            LEFT JOIN tasks ON h.task_id = tasks.id
            WHERE (task_id = ? OR ? is NULL)
                AND tasks.investigator = ?
            GROUP BY
                im.id`

        const rows = await dbOps.select(query, [taskId, taskId, userId])
        return rows
    },

    /**
     * Export task stat data.
     * @param {Number} userId - task owner's id
     * @param {Number} taskId - id of task data to be exported
     * @returns {Array.<Object>} - [{tag_id, tag_name, parent_tag_id, parent_tag_name,
     * image_id, hash, owner_id, original_name, selected}] 
     */
    async getDataExportByTaskId(userId, taskId) {
        // TODO: decide whether to limit by tasks owned. Not limiting is convenient for admin purposes.
        // BUT can be unsafe for data that should be private.
        const query = `SELECT
                            task_images.task_id as task_id,
                            task_images.image_id as image_id,
                            hotornot.user_id as observer_id,
                            hotornot.rating as rating,
                            images.original_name
                        FROM
                            task_images
                        LEFT JOIN hotornot on hotornot.task_id = task_images.task_id
                            and hotornot.image_id = task_images.image_id
                        LEFT JOIN images on images.id = task_images.image_id
                        WHERE
                            task_images.task_id = ?
                        UNION
                        SELECT
                            hotornot.task_id as task_id,
                            hotornot.image_id as image_id,
                            hotornot.user_id as observer_id,
                            hotornot.rating as rating,
                            images.original_name
                        FROM
                            hotornot
                        RIGHT JOIN task_images on hotornot.task_id = task_images.task_id
                            and hotornot.image_id = task_images.image_id
                        LEFT JOIN images on images.id = hotornot.image_id
                        WHERE
                            hotornot.task_id = ?`

        const rows = await dbOps.select(query, [taskId, taskId])

        return rows
    }
}

export default dataOps
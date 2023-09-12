import dbOps from './dbConnection.js'

// ---------------------------------
// TASK BASED DATABASE METHODS
// ---------------------------------
const taskOps = {
    async getTasks(userId) {
        const query = `SELECT id, prompt, short_name
                    FROM tasks
                    WHERE investigator = ?`
        const rows = await dbOps.select(query, [userId])

        return rows
    },

    async getTasked(userId) {
        const query = `SELECT tasks.id as id, tasks.short_name as short_name, tasks.prompt as prompt
                    FROM observers
                    LEFT JOIN tasks ON tasks.id = observers.task_id
                    WHERE observers.user_id = ?
                    ORDER BY tasks.id`
        const rows = await dbOps.select(query, [userId])

        return rows
    },
    
    async createTask(userId, short_name, prompt) {
        const query = `INSERT INTO tasks (short_name, prompt, investigator) VALUES (?, ?, ?);`
        try {
            const results = await dbOps.executeWithResults(query, [short_name, prompt, userId])
            return results.insertId
        } catch (err) {
            throw (err)
        }

    },

    async updateTask(userId, taskId, short_name, prompt) {
        const query = `UPDATE tasks
                    SET short_name = ?,
                        prompt = ?
                    WHERE investigator = ?
                        AND id = ?`
        try {
            await dbOps.execute(query, [short_name, prompt, userId, taskId])
            return true
        } catch (err) {
            throw (err)
        }

    },

    async deleteTask(userId, taskId) {
        const query = `DELETE FROM tasks WHERE tasks.investigator = ? AND tasks.id = ?;`
        try {
            await dbOps.execute(query, [userId, taskId])
            return true
        } catch (err) {
            throw (err)
        }
    },

    // Gets existing tasks, then collects image counts per task, observer count,
    // and sums the progress of all the observers for 'overall_progress' per task.
    async getTaskTable(userId) {
        // TODO: I think this can probably be cleaned up a little
        // getting image counts should only require the image_tags table,
        // and there maybe other redundant joins. For now it works!
        const query = `WITH image_count_table AS (
        SELECT task_images.task_id AS task_id, COUNT(DISTINCT task_images.image_id) AS image_count
        FROM task_images
        LEFT JOIN tasks ON tasks.id = task_images.task_id
        WHERE tasks.investigator = ?
        GROUP BY task_images.task_id
        ),
        observer_count_table AS (
        SELECT tasks.id AS task_id, COUNT(DISTINCT observers.user_id) AS observer_count
        FROM tasks
        LEFT JOIN observers ON observers.task_id = tasks.id
        WHERE tasks.investigator = ?
        GROUP BY tasks.id
        ),
        progress_table AS (
            SELECT hotornot.user_id, COUNT(DISTINCT hotornot.image_id) AS graded_images_count, hotornot.task_id,
            total_images.total_images,
            (COUNT(DISTINCT hotornot.image_id) / total_images.total_images) AS progress_percentage
        FROM hotornot
        JOIN (
            SELECT task_images.task_id as tt_id, COUNT(DISTINCT task_images.image_id) AS total_images
            FROM task_images
            GROUP BY task_images.task_id
        ) AS total_images ON total_images.tt_id = hotornot.task_id
        GROUP BY hotornot.task_id, hotornot.user_id
        ),
        overall AS (
            SELECT progress_table.task_id AS task_id, SUM(progress_table.progress_percentage)/COUNT(progress_table.progress_percentage) AS overall_progress
        FROM progress_table
        GROUP BY progress_table.task_id
        )
        SELECT tasks.id, tasks.short_name, tasks.prompt,
            COALESCE(image_count_table.image_count, 0) AS image_count,
            COALESCE(observer_count_table.observer_count, 0) AS observer_count,
            COALESCE(overall.overall_progress, 0) AS progress
        FROM tasks
        LEFT JOIN image_count_table ON tasks.id = image_count_table.task_id
        LEFT JOIN observer_count_table ON tasks.id = observer_count_table.task_id
        LEFT JOIN overall ON tasks.id = overall.task_id
        WHERE tasks.investigator = ?;`

        const rows = await dbOps.select(query, [userId, userId, userId])
        return rows

    },

    async getQuickTaskProgress(userId, taskId) {
        const query = `SELECT gradings.total / (images.total* observers.total) AS progress
        FROM (
            SELECT COUNT(*) as total
            FROM hotornot
            WHERE hotornot.task_id = ?
        ) AS gradings,
        (
            SELECT COUNT(*) AS total
            FROM task_images
            WHERE task_images.task_id = ?
        ) AS images,
        (
            SELECT COUNT(DISTINCT observers.user_id) AS total
            FROM observers
            WHERE observers.task_id = ?
        ) AS observers;`

        const rows = await dbOps.select(query, [taskId, taskId, taskId])
        return rows[0]
    },

    async getObservers(userId, taskId) {
        const query = `SELECT
              users.id,
              users.fullname as name,
              CASE WHEN task_id is NULL THEN 0 ELSE 1 END applied
            FROM users
              LEFT JOIN observers ON observers.user_id = users.id AND task_id = ?
            WHERE users.is_enabled = 1 AND users.is_pathologist = 1
            ORDER BY users.id`

        const rows = await dbOps.select(query, [taskId])
        return rows

    },

    // Update observers using transactions, if something fails nothing will be committed.
    async updateObservers(userId, taskId, observerIds) {
        const allQueries = []
        const allValues = []

        const observerRowValues = observerIds.map((id) => [taskId, id])

        allQueries.push(`DELETE FROM observers WHERE task_id = ?`)
        allValues.push([taskId])
        if (observerRowValues && observerRowValues.length) {
            allQueries.push(`INSERT INTO observers (task_id, user_id) VALUES ?`)
            allValues.push([observerRowValues,])
        }

        try {
            await dbOps.executeTransactions(allQueries, allValues)
            return true
        } catch (err) {
            throw (err)
        }
    },

    // get tags all tags owned, mark tags associated with task as applied
    async getTags(userId, taskId) {
        const query = `SELECT
              tags.id,
              tags.name as name,
              CASE WHEN task_tags.task_id is NULL THEN 0 ELSE 1 END applied
            FROM tags
              LEFT JOIN task_tags ON task_tags.tag_id = tags.id AND task_id = ?
            WHERE tags.user_id = ?
            ORDER BY tags.id`

        const rows = await dbOps.select(query, [taskId, userId])
        return rows

    },

    // Update task_tags using transactions, if something fails nothing will be committed.
    async updateTaskTags(userId, taskId, tagIds) {
        const allQueries = []
        const allValues = []

        const taskTagRowValues = tagIds.map((id) => [taskId, id])

        allQueries.push(`DELETE FROM task_tags WHERE task_id = ?`)
        allValues.push([taskId])
        if (taskTagRowValues && taskTagRowValues.length) {
            allQueries.push(`INSERT INTO task_tags (task_id, tag_id) VALUES ?`)
            allValues.push([taskTagRowValues,])
        }

        try {
            await dbOps.executeTransactions(allQueries, allValues)
            return true
        } catch (err) {
            throw (err)
        }
    },

    // get all images associated with a user and mark images that
    // are selected for the taskId
    async getImages(userId, taskId) {

        const query = `SELECT 
                tags.id as tag_id,
                tags.name as tag_name,
                tag_relations.parent_tag_id as parent_tag_id,
                tags2.name as parent_tag_name,
                images.id as image_id,
                images.path, images.hash,
                images.user_id as owner_id,
                images.original_name as original_name,
                CASE WHEN selected.picked IS NOT NULL THEN TRUE ELSE FALSE END as selected
            FROM tags
            LEFT JOIN image_tags ON image_tags.tag_id = tags.id
            LEFT JOIN images ON images.id = image_tags.image_id
            LEFT JOIN tag_relations ON tag_relations.tag_id = tags.id
            LEFT JOIN tags as tags2 ON tag_relations.parent_tag_id = tags2.id
            LEFT JOIN (
              SELECT DISTINCT task_images.image_id as image_id, TRUE AS picked
              FROM task_images
              WHERE task_id = ?
            ) selected ON selected.image_id = images.id
            WHERE tags.user_id = ?
            ORDER BY tags.id`

        const rows = await dbOps.select(query, [taskId, userId])
        return rows

    },

    // Save a list of image ids for a specified task
    async setTaskImages(userId, taskId, imageIds) {
        const allQueries = []
        const allValues = []

        const taskImageRowValues = imageIds.map((id) => [taskId, id])

        allQueries.push(`DELETE FROM task_images WHERE task_id = ?`)
        allValues.push([taskId])
        if (taskImageRowValues && taskImageRowValues.length) {
            allQueries.push(`INSERT INTO task_images (task_id, image_id) VALUES ?`)
            allValues.push([taskImageRowValues,])
        }

        try {
            await dbOps.executeTransactions(allQueries, allValues)
            return true
        } catch (err) {
            throw (err)
        }

    }
}

export default taskOps
// import Pool from 'mysql2/typings/mysql/lib/Pool'
import path from 'path'

// TODO: move to documentation
// Prepared statements: mysql2 execute() vs query()
// https://github.com/sidorares/node-mysql2/issues/553#issuecomment-437221838
// Why are prepared statements better
/** However, the most important advantage of prepared statements is that they help prevent SQL injection attacks. SQL injection is a technique to maliciously exploit applications that use client-supplied data in SQL statements. Attackers trick the SQL engine into executing unintended commands by supplying specially crafted string input, thereby gaining unauthorized access to a database to view or manipulate restricted data. SQL injection techniques all exploit a single vulnerability in the application: Incorrectly validated or nonvalidated string literals are concatenated into a dynamically built SQL statement and interpreted as code by the SQL engine. Prepared statements always treat client-supplied data as content of a parameter and never as a part of an SQL statement.
from: https://docs.oracle.com/javase/tutorial/jdbc/basics/prepared.html
*/


async function buildMySqlConnection(dbConfig) {
    const { default: mysql } = await import('mysql2/promise')
    // Using createPool instead of createConnection fixes an issue with sql
    // server timeouts and matches api recommendations.
    const db = mysql.createPool({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        multipleStatements: dbConfig.multipleStatements,
    })
    
    return db
}

async function buildSqliteConnection(dbConfig) {
    const { default: sqlite3 } = await import('sqlite3')
    sqlite3.verbose()
    const sqlite = await import('sqlite')
    // Because this database file is typically created with a script,
    // it has been hard coded here.
    const databasePath = path.resolve('../html/pathapp.sqlite3')
    const db = await sqlite.open({
        filename: databasePath,
        driver: sqlite3.Database
    })
    
    return db
}

/**
 * Mysql query wrapper to flatten results to just the array of rows.
 * @param {Pool} db Mysql Pool object
 * @returns {Function} Returns an async function that extracts row results from
 * mysql's [rows, fields]
 */
function simplifyQuery(db) {
    return async (sql, values) => {
        const [rows] = await db.execute(sql, values)
        return rows
    }
}

/** DatabaseOps class to handle the differences between database protocols. */
class DatabaseOps {
    /**
     * Based on the configuration ["type"], a connection with the matching
     * protocol/type is built. Currently the default type is MySql, with
     * "sqlite3" being the alternative.
     * @param {Object.<string, *>} dbConfig An object that should contain
     * information needed to build a sql database connection. (host, user,
     * password, database[name of db], multipleStatements[boolean])
     */
    constructor(dbConfig) {
        this.dbConfig = dbConfig
        
        if (this.dbConfig.type === 'sqlite3') {
            // Suitable for local development
            console.log('Using SQLITE3 as the database protocol.')
            this.db = buildSqliteConnection(dbConfig).then((db) => {
                // Sqlite specific modifications to unify methods
                db._select = db.all
                db._execute = db.run
                return db
            })
        } else {
            // Default and recommend for production
            console.log('Using MYSQL as the database protocol.')
            this.db = buildMySqlConnection(dbConfig).then((db) => {
                // Mysql specific modifications to unify methods
                db._select = simplifyQuery(db)
                db._execute = db.execute
                return db
            })
        }
    }

    /**
     * Process select queries that return rows as results.
     * @param {string} sql Sql string template - 'Select * From tbl Where id=?'
     * @param {Array.<*>} values Values to populate sql template
     * @returns {Promise<Array.<Object>>} Returns an array of json result objects. Keys =
     * table column names.
     */
    async select(sql, values) {
        const db = await this.db
        const results = await db._select(sql, values)
        return results
    }

    /**
     * Process queries other than select(UPDATE, INSERT, etc.)
     * @param {string} sql Sql string template - 'Select * From tbl Where id=?'
     * @param {Array.<*>} values Values to populate sql template
     * @returns {boolean} Returns true upon completion
     */
    async execute(sql, values) {
        const db = await this.db
        await db._execute(sql, values)
    }

    /**
     * Process queries other than select(UPDATE, INSERT, etc.) and get results obj
     * @param {string} sql Sql string template - 'Select * From tbl Where id=?'
     * @param {Array.<*>} values Values to populate sql template
     * @returns {Object} Returns the results object which has insertId
     */
    async executeWithResults(sql, values) {
        const db = await this.db
        const [results, fields] = await db._execute(sql, values)
        return results
    }

    // NOTE: No longer used but keeping for reference
    // https://github.com/sidorares/node-mysql2/issues/384#issuecomment-673726520
    async executeTransactions(sqlQueries, queryValues) {
        let conn = null;
        try {
            const db = await this.db // the await is needed to enter the promise chain
            conn = await db.getConnection()
            await conn.beginTransaction()
            for (let i in sqlQueries) {
                // check if there are queryValues
                if (queryValues[i] && queryValues[i].length) {
                    await conn.query(sqlQueries[i], queryValues[i])
                } else {
                    // NOTE: It is up to the user not to submit an empty query
                    await conn.query(sqlQueries[i])
                }
            }
            // const [response, meta] = await conn.query('')
            await conn.commit()
        } catch (error) {
            if (conn) await conn.rollback()
            throw error
        } finally {
            if (conn) await conn.release()
        }
    }

    // NOTE: Not tested with sqlite
    /** Start a database transaction. Returns a TransactionContainer */
    async startTransaction() {
        let connection = null
        try {
            const db = await this.db
            connection = await db.getConnection()
            await connection.beginTransaction()
            const transaction = new TransactionContainer(connection)
            return transaction
        } catch (error) {
            if (connection) connection.release()
            throw error
        }
    }

}

/**
 * Contains a mysql transaction that has already been started.
 */
class TransactionContainer {
    constructor(dbConnection) {
        this.dbConnection = dbConnection
    }

    /** Run a sql query with associated values. */
    async query(sqlQuery, queryValues) {
        try {
            const [results] = await this.dbConnection.execute(sqlQuery, queryValues)
            return results
        } catch (error) {
            if (this.dbConnection) {
                await this.dbConnection.rollback()
                await this.dbConnection.release()
            }
            throw error
        }
    }

    /** Save and commit all preceding queries. */
    async commit() {
        try {
            await this.dbConnection.commit()
        } catch (error) {
            if (this.dbConnection) await this.dbConnection.rollback()
            throw error
        } finally {
            if (this.dbConnection) {
                this.dbConnection.release()
            }
        }
    }
}

export { DatabaseOps }
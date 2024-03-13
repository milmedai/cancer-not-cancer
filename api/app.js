// Tag our process to easily identify later
import process from 'node:process'
process.title = process.title + ' app.js [CancerNotCancer API]'
console.log("PID: " + process.pid + " process title is " + process.title)

/**********************************************
 * IMPORTS
 **********************************************/
// Basic stuff for the server
import express from 'express' // We have an express server (https://expressjs.com/)

/// Features
import bodyParser from 'body-parser' // JSON parsing is NOT default with http; we have to make that possible (https://www.npmjs.com/package/body-parser)

import { isLoggedIn, isEnabled, isPathologist, getIP } from './lib/functions.js'     // Helper functions
// These are all for authentication
import auth from './lib/auth.js' // This needs to be loaded for passport.authenticate

/**********************************************
 * SERVER SETUP
 **********************************************/
// Make the server
const app = express()

auth.setup(app) // Setup authentication routes for the app
const port = process.env.PORT || 5000;


/******************
 * DATABASE Methods
 ******************/
import dataOps from './dbOperations/dataOps.js'

import taskRoutes from './routes/tasks.js'
import userRoutes from './routes/users.js'
import imageRoutes from './routes/images.js'
import dataRoutes from './routes/data.js'

/******************
 * REQUEST PARSING
 * 
 * These are vital for their respective areas
 ******************/

// JSON body structure, default limit is 100kb
app.use(bodyParser.json({
    type: 'application/json',
    // limit: '10mb'
}));

// Server images if using local development
if (process.env.NODE_ENV != 'production') {
    console.log('Serving images locally from:')
    console.log(`  ${process.env.IMAGES_DIR}`)
    app.use('/images', express.static(process.env.IMAGES_DIR))
}


/**********************************************
 * Express REQUESTS
 **********************************************/

app.use('/tasks', taskRoutes)
app.use('/users', userRoutes)
app.use('/images', imageRoutes)
app.use('/data', dataRoutes)

/*****************
 * GET
 *****************/

// Checker for if the user is authenticated (NOT middleware)
app.get('/isLoggedIn', (req, res) => {
    if (req.isAuthenticated()) {
        res.send(req.user)
    } else {
        // Send false/no user data
        res.status(200).send(false)
    }
})

/*****************
 * POST
 *****************/


// Insert the hotornots
app.post('/hotornot', isLoggedIn, isEnabled, isPathologist, async (req, res, next) => {
    console.log("post /hotornot")
    // REMEMBER: the data in body is in JSON format

    // Check types
    let flag = false
    let message = []
    if (typeof req.body.id !== 'number') {
        flag = true
        message += "Image ID is not a number"
    } if (typeof req.body.rating !== 'number') {
        flag = true
        message += "Rating is not a number"
    } if (typeof req.body.comment !== 'string') {
        flag = true
        message += "Message is not a string"
    } if (flag) {
        res.status(415).send(message)
        return
    }

    // Check comment length: MariaDB has a max text length of 65,535 characters
    if (req.body.comment.length > 65535) {
        res.status(413).send(["Comment too long"])
        return
    }
    
    try {
        await dataOps.addRating(
            req.user.id,
            req.body.id,
            req.body.rating,
            req.body.comment,
            getIP(req),
            req.body.taskId
        )

        res.sendStatus(200)
    } catch (err) {
        next(err) // Pass error onto unified error handler.
    }
})


// Unified error handler
app.use((err, req, res, next) => {
    console.log("Sending status(500). Route error caught...")
    console.error('\x1b[31m', err.stack, '\x1b[0m')
    res.sendStatus(500)
})

/**********************************************
 * LISTEN
 **********************************************/

// Listen to the port
app.listen(port, () => {
    console.log(`CNC running on port ${port}`);
})

// This is to control shutdown
// nodemon sends out `SIGUSR2` to restart
process.once('SIGUSR2', () => {
    // This is to kill the process
    process.kill(process.pid);
})




/**********************************************
 * EXTRA
 **********************************************/

// DEV: this to reduce the request for logging json
// const { route, user, _sessionManager, isUnauthenticated, isAuthenticated, logout, logOut, login, logIn, _passport, session, sessionID, sessionStore, _parsedOriginalUrl, signedCookies, cookies, secret, res, query, params, _parsedUrl, originalUrl, baseUrl, next, _dumped, _consuming, client, statusMessage, statusCode, method, url, upgrade, aborted, rawTrailers, trailers, rawHeaders, headers, complete, httpVersion, httpVersionMinor, httpVersionMajor, connection, socket, _maxListeners, _eventsCount, _events, readable, _readableState, body, ...qux } = req
// console.log(qux)
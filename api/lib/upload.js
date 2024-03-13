// Custom upload handler with busboy dependency
import * as fs from 'node:fs';
import os from 'os'
import path from 'path'
import busboy from 'busboy'
import { randomUUID, createHash } from 'crypto'
import { customAlphabet } from 'nanoid/async'
import sanitize from 'sanitize-filename'
import deleteEmpty from 'delete-empty'

const imageBaseURL = process.env.IMAGE_URL

// Removing the dash and hyphen from ids for upload folders
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 20)

function sanitizeFilename(filename) {
    const sanitized = path.normalize(filename)
                        .split(path.sep)
                        .map(part => sanitize(part))
                        .filter(part => part !== "")
                        .join(path.sep)
    return sanitized
}

// Creates a directory if it doesn't already exist
async function createDirectory(dirPath) {
    try {
        await fs.promises.access(dirPath)
    } catch (error) {
        // ENOENT means the directory doesn't exist, so we make the directory.
        if (error.code === 'ENOENT') {
            await fs.promises.mkdir(dirPath, { recursive: true })
        } else {
            throw error;
        }
    }
}

export async function removeEmptyImageFolders() {
    try {
        const imageDirectory = path.resolve(process.env.IMAGES_DIR)
        let deletedFolders = await deleteEmpty(imageDirectory)
        if (deletedFolders.length > 0) {
            console.log('Empty folders removed:')
            console.log(deletedFolders)
        }
    } catch (err) {
        console.error(err)
    }
}

// Removes a file if it can.
export async function removeFile(filePath) {
    try {
        await fs.promises.rm(filePath)
        console.log(`removed: ${filePath}`)
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`removeFile: ${filePath} didn't exist.`)
        } else {
            console.error(`Error removing file: ${filePath}`, error)
        }
    }
}

// File info is used to communicate back to the client whether a file uploaded successfully or not.
function updateFileInfo(fileInfo, success, message) {
    fileInfo.success = success !== undefined ? success : false
    fileInfo.message = message;
}

// Save a readablestream to disk. First saves to the temporary director, then
// moves the complete save to the image directory.
async function saveFile(file, fileInfo) {
    // tmpdir stores files for 3~10 days
    const saveTo = path.join(os.tmpdir(), path.basename(fileInfo.savePath))
    const moveTo = path.join(fileInfo.savePath)

    // Since we are trying to preserve the path we have to do a lot of directory creating.
    try {
        await createDirectory(path.dirname(saveTo))
    } catch (error) {
        console.log('Create directory error:', error)
        return
    }

    // file to write to, using a writableStream
    const fileWriter = fs.createWriteStream(saveTo)

    // Here connect the read and write stream. We want to wait for them to finish
    // before moving onto moving them to their final destination. Hence the new Promise.
    // With the promise we can catch all the error and have a generic failed save in the catch.
    try {
        await new Promise((resolve, reject) => {
            file.pipe(fileWriter)
            
            // We can create a hash of the file by piping to a hash stream.
            // Using sha265, but all openssl algorithms are available.
            // We are encoding the hash as base64, but hex is also an option.
            const hash = createHash('sha256')
            file.pipe(hash)
            hash.on('error', err => { console.error(err) })
            hash.on('finish', () => { fileInfo.hash = hash.digest('base64') })

            // on read stream errors (failed reading the uploading file)
            file.on('error', (err) => {
                if (err === 'ECONNRESET' ) {
                    console.error(`connection aborted for ${fileInfo.sanitizedName}`)
                } else {
                    console.error('FileStream error:', err)
                }
                file.unpipe()
                file.destroy('abort')
                fileWriter.destroy('abort')
                reject(err)
            })
            // on write stream error (failed writing the file)
            fileWriter.on('error', (err) => {
                console.error('FileWriter error:', err)
                reject(err)
            })
            // success
            fileWriter.on('finish', resolve)
        })
    } catch (error) {
        console.error('Upload write error:', error)
        await removeFile(saveTo) // remove half upload files
        updateFileInfo(fileInfo, false, `Upload Aborted: ${fileInfo.sanitizedName}`)
        return
    }

    // At this point we can see if busboy limited a file because of the size limit.
    // If so we want to remove it.
    if (file.truncated) {
        console.log(`LIMIT: ${fileInfo.sanitizedName} was too large. Removing...`)
        await removeFile(saveTo)
        updateFileInfo(fileInfo, false, `File was larger than: ${process.env.UPLOAD_SIZE_LIMIT}B`)
        return
    }

    // Finally we want to try and move the successfully uploaded file to its final destination.
    try {
        await createDirectory(path.dirname(moveTo)) // make sure the destination directories exist
        await fs.promises.rename(saveTo, moveTo) // move the files
        // Success
        console.log(`${'moved:'.padStart(8)} ${saveTo}\n${'to:'.padStart(8)} ${moveTo}`)
        updateFileInfo(fileInfo, true)
    } catch (error) {
        console.error('Could not move file:', error)
        await removeFile(saveTo)
        updateFileInfo(fileInfo, false, `Could not properly save file: ${fileInfo.sanitizedName}`)
    }
}

// date string helper : https://stackoverflow.com/a/17415677/3068136
function toIsoWithTimezoneString(date) {
    var tzo = -date.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function (num) {
            return (num < 10 ? '0' : '') + num;
        };

    return date.getFullYear() % 100 +
        '' + pad(date.getMonth() + 1) +
        '' + pad(date.getDate()) +
        '_' + pad(date.getHours()) +
        '-' + pad(date.getMinutes()) +
        '-' + pad(date.getSeconds()) +
        'TZ' + dif + pad(Math.floor(Math.abs(tzo) / 60)) +
        '-' + pad(Math.abs(tzo) % 60);
}

async function runBusboy(saveDirectory, {req, res, next}) {
    const busboyConfig = {
        headers: req.headers, // pass headers to busboy
        limits: {
            fieldNameSize: 100, //typically 100
            fileSize: process.env.UPLOAD_SIZE_LIMIT // in bytes
        },
        preservePath: true
    }

    const files = [] // keep track of the files for communicating success or failure.
    let finished = false // busboy upload status
    const bb = busboy(busboyConfig)


    // When all files have the property 'succees' AND busboy is finished,
    // we can send our response.
    function onWriteFinish() {
        if (files.every(fileObj => fileObj.hasOwnProperty('success')) && finished) {
            const isoDate = new Date().toISOString()
            console.log(`${isoDate}: Upload Complete`)
            req.files = files
            next()
        }
    }

    // Listen for files being uploaded
    bb.on('file', async (fieldName, fileStream, fileInfo) => {
        let isAcceptable = false
        fileInfo.sanitizedName = sanitizeFilename(fileInfo.filename)
        fileInfo.id = await randomUUID()
        fileInfo.savePath = path.join(process.env.IMAGES_DIR, saveDirectory, fileInfo.id)
        fileInfo.relPath = path.join(saveDirectory, fileInfo.id)
        //TODO: Determine is relPath is needed, use imageUrl instead. Sync with 'allowedKeys'

        // make sure the file is an image
        if (fileInfo.mimeType == 'image/jpeg') {
            fileInfo.savePath += '.jpeg'
            fileInfo.relPath += '.jpeg'
            isAcceptable = true
        } else if (fileInfo.mimeType == 'image/png') {
            fileInfo.savePath += '.png'
            fileInfo.relPath += '.png'
            isAcceptable = true
        }

        if (isAcceptable) {
            fileInfo.imageUrl = new URL(fileInfo.relPath, imageBaseURL).href
        }

        // track files
        files.push(fileInfo)

        if (!isAcceptable) {
            fileStream.resume() // skips file read stream
            updateFileInfo(fileInfo, false, 'File not accepted.')
        } else {
            // Try saving the file
            try {
                await saveFile(fileStream, fileInfo)
            } catch (error) {
                console.error('Save file error:', error)
                updateFileInfo(fileInfo, false, 'Could not save file.')
            }
        }

        onWriteFinish()
    })

    bb.on('error', (err) => {
        console.error('busboy error:', err)
        finished = true
    })

    bb.on('finish', () => {
        finished = true
        onWriteFinish() // catch when bb finishes last
    })

    // busboy unused events
    // bb.on('close', () => {})
    // bb.on('unpipe', (stream) => {})

    // Used to detect if the upload connection breaks.
    req.on('error', (err) => {
        console.error('REQUEST ERROR:', err)
        req.unpipe()
        bb.destroy(err.code)
    })

    // Connect the request to busboy
    req.pipe(bb);
}

export async function isMultipart(req, res, next) {
    // Check for proper content-type, needs to be multipart/form-data
    // busboy should error out on malformed data, be we do our own check before starting.
    if (req.headers['content-type'].includes('multipart/form-data')) {
        next()
    } else {
        res.status(415).send('Content-Type must be multipart/form-data.')
    }
}

// Handle upload image(s) request for express
export async function uploadImages(req, res, next) {
    // console.log('UPLOAD REQUEST MADE::', req.headers)
    const folderDateString = toIsoWithTimezoneString(new Date(req.headers.uploadtime))

    // Consider hashing the userid
    const saveDirectory = `${req.user.id}_${folderDateString}`
    // straight hash for directory
    // const saveDirectory = await nanoid()
    
    runBusboy(saveDirectory, {req, res, next}) 
}

// Handle upload image(s) for the annotation guide
export async function uploadAnnotationImages(req, res, next) {
    const saveDirectory = `${req.user.id}_annotations`

    runBusboy(saveDirectory, { req, res, next })
}

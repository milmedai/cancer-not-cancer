import fs from 'node:fs'

// Specify the paths for the source and destination files
const sourceFilePath = '/Users/my_name/Desktop/MaxBread.jpeg'; // Update with the actual path of your source image
const destinationFilePath = '/Users/my_name/Desktop/myDupe.jpg'; // Update with the desired path for the destination image

// // Read the source image file
// fs.readFile(sourceFilePath, (err, data) => {
//     if (err) {
//         console.error('Error reading the source image file:', err);
//     } else {
//         // Write the data to the destination image file
//         fs.writeFile(destinationFilePath, data, (err) => {
//             if (err) {
//                 console.error('Error writing the destination image file:', err);
//             } else {
//                 console.log('Image file successfully saved to', destinationFilePath);
//             }
//         });
//     }
// });


import imagemin from 'imagemin'
import imageminMozjpeg from 'imagemin-mozjpeg'
import imageminJpegtran from 'imagemin-jpegtran'
import { mkdir, rename, rmdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const remove = "ed14526987aed808_1_"
const basePath = "/Users/my_name/Desktop/conversion"

async function makeMozJpeg(inputDir) {
    const outFolder = 'moz-output'
    await imagemin([`${inputDir}/*.jpg`], {
        destination: join(inputDir, outFolder),
        plugins: [
            imageminMozjpeg({
                quality: 85,
                progressive: true,
                quantTable: 3, // ImageMagick
            })
        ]
    });
}

async function makeJpegTrans(inputDir) {
    const outFolder = 'trans-output'
    await imagemin([`${inputDir}/*.jpg`], {
        destination: join(inputDir, outFolder),
        plugins: [
            imageminJpegtran({
                progressive : true
            })
        ] 
    })
}

async function processFile(filename, baseFolder) {
    try {
        const name = filename.replace(/\.[^/.]+$/, '')
        const ext = filename.split('.').pop()
        const folderName = name.replace(remove, '')
        const workingPath = join(baseFolder, folderName)
        const originalImgPath = join(baseFolder, filename)
        const workingImage = join(workingPath, filename)
        await mkdir(workingPath)
        await rename(originalImgPath, workingImage)
        await makeMozJpeg(workingPath)
        // await makeJpegTrans(workingPath)
        await rename(join(workingPath, 'moz-output', filename), join(workingPath, filename.replace(`.${ext}`, `-moz.${ext}`)))
        // await rename(join(workingPath, 'trans-output', filename), join(workingPath, filename.replace(`.${ext}`, `-trans.${ext}`)))
        await rmdir(join(workingPath, 'moz-output'))
        // await rmdir(join(workingPath, 'trans-output'))
    } catch (error) {
        console.log(error)
    }
}

(async () => {

    fs.readdir(basePath, (err, files) => {
        files.forEach(file => {
            const extension = file.split('.').at(-1).toLowerCase()
            if (extension === 'jpeg' || extension === 'jpg') {
                processFile(file, basePath, extension)
            }
        });
    });

    // await imagemin([sourceFilePath], {
    //     destination: 'output',
    //     plugins: [
    //         imageminMozjpeg({
    //             quality: 75,
    //             progressive: true,
    //             quantTable: 3, // ImageMagick
    //         })
    //     ]
    // });

    // console.log('Images optimized');
})();
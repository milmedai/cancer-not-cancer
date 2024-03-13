

export const useImageUpload = () => {
    const api = useApi()
    const config = useRuntimeConfig()
    const acceptableFormats = ['image/png', 'image/jpeg']

    /**
     * Upload array of image files
     */
    const uploadImages = async (files, apiDestination) => {
        const uploadHeader = {
            'uploadtime': new Date().toISOString()
        }

        const rawData = []

        // Add the files array object
        files.forEach((file, index) => {
            if (file.size > config.public.uploadSizeLimit) {
                console.error(`${file.name} is too large. MAX_BYTES: ${config.public.uploadSizeLimit}`)
                return
            }

            const fileName = file.webkitRelativePath === '' ? file.name : file.webkitRelativePath
            rawData.push({
                'key': `files[${index}]`,
                'file': file,
                'fileName': fileName
            })
        })

        try {
            // image upload requires submittion via form data 
            const formData = new FormData
            for (const fileObj of rawData) {
                formData.append(fileObj.key, fileObj.file, fileObj.fileName)
            }

            uploadHeader['finalblock'] = true

            const { response } = await api.POST(apiDestination, formData, null, uploadHeader)

            if (response.value !== 'No files uploaded.') {
                // success
                return response.value
            } else {
                console.log('No Files to Upload')
            }

        } catch (error) {
            // TODO: Determine when error.data exists
            if (error.data) {
                for (const file of error.data) {
                    // update failed status
                    console.warn(`${file.filename} failed to upload.`)
                }
            } else {
                // Generic Error
                console.error(error)
            }
        }
    }

    /** Filter dataTransfer items to just image files. */
    const getImageFiles = async (items) => {
        const imageFiles = []

        if (items) {
            Array.from(items).forEach(item => {
                if (item.kind === 'file' && acceptableFormats.includes(item.type)) {
                    const file = item.getAsFile()
                    imageFiles.push(file)
                }
            })
        }

        return imageFiles

    }

    return {
        async uploadImageFilesForAnnotations(event) {
            const items = event.dataTransfer.items;
            const imageFiles = await getImageFiles(items)
            if (!imageFiles.length) return
            const savedFiles = await uploadImages(imageFiles, '/images/annotations/')
            return savedFiles
        },
        uploadImageFilesForGrading(event) {

        }
    }
}


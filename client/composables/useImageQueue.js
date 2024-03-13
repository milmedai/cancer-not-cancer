/**
 * @typedef {Object} BaseImageObject 
 * @property {string} imageUrl - the source url of the image
 * @property {?number} chipSize - size of the roi
 * @property {?number} fovSize - size of the chip and surrounding context
 * @property {?number} zoomScale - the amount to zoom when clicked
 * @property {string} name - image name
 * @property {number} image_id - image id
 */

/**
 * @typedef {BaseImageObject & Object} QueueObject
 * @property {boolean} loaded - Indicates whether the image is loaded. 
 * @property {?HTMLImageElement} imgHtml - The created HTMLImageElement
 * @property {?number} rating - The rating a view assigns to the image. 
 */

/**
 * 
 * @typedef {Array<QueueObject>} ImageQueue 
 */

export const useImageQueue = (maxPreload) => {
    const additionalAttributes = {
        loaded: false,
        imgHtml: null,
        rating: null
    }

    /**
     * @type {Ref<ImageQueue>}
     */
    const queue = ref([])
    const index = ref(0)
    let chained = true // chain multiple loads together


    /**
     * 
     * @param {BaseImageObject} imageObject
     */
    const addImage = (imageObject) => {
        queue.value.push({...imageObject, ...additionalAttributes})
    }

    /**
     * 
     * @param {Array<BaseImageObject>} arrayOfImageObjects 
     */
    const addImages = (arrayOfImageObjects) => {
        for (const imageObject of arrayOfImageObjects) {
            addImage(imageObject)
        }
    }    

    /**
     * Is this image object loaded?
     * @param {QueueObject} imgObj 
     * @returns {boolean}
     */
    const isLoaded = (imgObj) => imgObj.loaded || imgObj.imgHtml     

    /**
     * Loads an image in the background with a HTMLImageElement. Also depending on
     * maxPreload and chained, it will load the following image sequentially.
     * @param {Number} indx The next image to load
     * @param {Number} preLoadCount - number of images currently preloaded
     */
    const loadImage = (indx, preLoadCount = 0) => {
        // no more images to load
        if (indx >= queue.value.length) return

        // image data object to be loaded
        const item = queue.value[indx]

        // Already loaded
        if (isLoaded(item)) return

        const img = new Image()
        item.imgHtml = img
        img.loading = 'eager' // prevent lazy loading
        img.src = item.imageUrl
        img.onload = () => {
            item.loaded = true
            delete item.imgHtml // remove HTMLImageElement to save memory

            // chain together to queue up multiple preloaded images
            if (preLoadCount < maxPreload && chained) {
                loadImage(indx + 1, preLoadCount + 1)
            } else {
                chained = false
            }
        }
    }

    /**
     * Returns the next image for rating/grading.
     * @returns {QueueObject}
     */
    const getNextImage = () => {
        if (index.value >= queue.value.length) {
            // TODO: Consider looping to the beginning
            console.log('No more photos')
            return null
        }

        const currentItem = queue.value[index.value]

        if (!isLoaded(currentItem)) {
            // first or newly added images
            chained = true
            loadImage(index.value, 0)
        } else if (!chained) {
            // load 1 image to keep the preloaded queue full
            loadImage(index.value + maxPreload, maxPreload - 1)
        }
        index.value += 1
        return currentItem
    }

    /**
     * Reset/Empty the image queue for a new set of images
     */
    const reset = () => {
        queue.value = []
        index.value = 0
    }

    return {
        addImage,
        addImages,
        getNextImage,
        reset,
    }

}
<template>
    <div class='app' :style='cssVars'>
        <div class="bg no" :class="{'fade-out': transitioningOut}"></div>
        <div class="bg yes" :class="{'fade-out': transitioningOut}"></div>

        <!-- Image to grade -->
        <div class='prompt'>
            <div class='controls is-flex mb-5'>
                <TaskPicker class="is-flex-grow-1" @taskSelected="(newTaskId) => { currentTaskId = newTaskId }"></TaskPicker>
                <button class="button is-flex-shrink-1 is-warning is-light" type="button" @click="showAnnotationGuide">
                    <span class="icon">
                        <fa-icon :icon="['fa', 'question']" />
                    </span>
                </button>
            </div>
            <div class="has-text-danger" v-if="noMoreImages">No more images available in this task.</div>

            <ImageSwipe @swipe-move="updatePercent" @swipe-end="swipeEnd" :disabled="disableSwipe">
                <ImageDisplay
                    v-if="!noMoreImages"
                    :imageUrl="onDeck?.imageUrl"
                    :altText="onDeck?.name"
                    :chipSize="onDeck?.chipSize"
                    :fovSize="onDeck?.fovSize"
                    :zoomScale="onDeck?.zoomScale"
                />
            </ImageSwipe>  

            <div v-if='onDeck' class='controls level'>
                <p class="help is-hidden-desktop">Tap to zoom.</p>
                <p class="help is-hidden-touch">Click to zoom.</p>
            </div>
        </div>
        
        <!-- Response section: grade + comment --> 
        <div v-if="!noMoreImages" class='response-area'>
            <div class="has-text-centered swipe-pad" :class="{ 'shown': !commenting }">
                <span class='icon swipe left'>
                    <img src="~assets/icons/arrow-set.svg" alt="swipe left">
                </span>
                <span class='icon swipe right'>
                    <img src="~assets/icons/arrow-set.svg" alt="swipe right">
                </span>
            </div>

            <!-- Grade buttons -->
            <div class='block grade-buttons'>
                <button class='button no' :class="{ 'shown': moveLeft }" @click="onClick('no')">No</button>
                <button class='button maybe' @click="onClick('maybe')">Maybe</button>
                <button class='button yes' :class="{ 'shown': moveRight }" @click="onClick('yes')">Yes</button>
            </div>

            <!-- Comment -->
            <button class='button icon-button comment' @click='commenting = !commenting'>
                <span class='icon'>
                    <fa-icon :icon="['fas', 'pencil']" class="fa-xl" />
                </span>
            </button>
            <div class="container">
                <textarea class='textarea block' :class="{ 'shown': commenting }" placeholder="Add a comment to this image or leave blank." v-model="comment"></textarea>
            </div>

        </div>

        <AnnotationGuide v-if="showGuide" @exit="showGuide = !showGuide" :task-id="currentTaskId"/>
    </div>
</template>

<script>
import { mapState } from 'pinia'
import { useUserStore } from '~/store/user'
const api = useApi()
const imageQueue = useImageQueue(1)

const IMAGE_TRANSITION_TIME = 250 // ms
// const IMAGE_TRANSITION_TIME = 2000 // ms
export default {
    data() {
        return {
            // Information to display and grade the current image
            onDeck: null,
            queue: imageQueue,
            currentTaskId: null,
            tasks: [],
            noMoreImages: false,
            showGuide: false,

            // State information
            rating: '',
            comment: '',
            commenting: false,
            transitioningOut: false,

            // For swiping
            moveRight: false,
            moveLeft: false,
            percent: 0.0,
        }
    },
    async mounted() {
        if (this.isLoggedIn) {
            const { response } = await api.GET('/tasks/')
            this.tasks = response.value
            this.currentTaskId = this.tasks[0].id
        }
    },
    

    computed: {
        ...mapState(useUserStore, ['isLoggedIn', 'isPathologist']),
        // give the attribute `:style='cssVars'` to anything that should have access to these variables
        currentTask() {
            return this.tasks.find((task) => task.id === this.currentTaskId)
        },
        cssVars() {
            return {
                '--bg-no-opacity': (this.percent < 0 ? this.percent*-1.0 : 0),
                '--bg-yes-opacity': (this.percent > 0 ? this.percent*1.0 : 0),
                '--img-trans': IMAGE_TRANSITION_TIME + 'ms'
            }
        },
        disableSwipe() {
            return !this.onDeck || this.showGuide
        }
    },
    watch: {
        isLoggedIn: {
            async handler(loggedIn) {
                if (loggedIn) {
                    // Previously not logged in, and now logged in.
                    const { response } = await api.GET('/tasks/')
                    this.tasks = response.value // because response is a ref object
                    this.currentTaskId = this.tasks[0].id

                }
            }
        },
        currentTaskId: {
            handler(newTaskId) {
                this.queue.reset()
                this.noMoreImages = false
                this.getNewQueue()
            }
        },
        onDeck: {
            async handler(newValue, oldValue) {
                if (newValue === null && oldValue !== null) {
                    // end of queue... get more images if possible
                    this.getNewQueue()
                }
            }
        }
    },
    methods: {
        async getNewQueue() {
            try {
                const { response } = await api.GET(`/images/task/${this.currentTaskId}`)
                if (response.value.length === 0) {
                    this.noMoreImages = true
                } else {
                    const imageArray = response.value.map(imgData => {
                        return {
                            ...imgData,
                            'chipSize': this.currentTask.chip_size,
                            'fovSize': this.currentTask.fov_size,
                            'zoomScale': this.currentTask.zoom_scale,
                        }
                    })

                    // shuffle the images
                    shuffleArray(imageArray)
                    this.queue.addImages(imageArray)
                    this.onDeck = this.queue.getNextImage()
                }
            } catch (error) {
                console.error(error)
            }
        },
        updatePercent(newPercent) {
            this.percent = newPercent
            
            if (this.percent >= 1) {
                this.moveLeft = false
                this.moveRight = true
            } else if (this.percent <= -1) {
                this.moveLeft = true
                this.moveRight = false
            } else {
                this.moveLeft = false
                this.moveRight = false
            }
        },

        swipeEnd(direction) {
            if (direction === 'right') {
                this.onClick('yes')
            } else if (direction === 'left') {
                this.onClick('no')
            } else if (direction === 'up') {
                this.commenting = true
            } else if (direction === 'down') {
                this.commenting = false
            }
        },
        /**********************************************
        * App Control
        **********************************************/
        // when a button is clicked
        async onClick(source) {
            // determine the message based on source
            if (source === 'yes') {
                this.rating = 1
            } else if (source === 'no') {
                this.rating = -1
            } else if (source === 'maybe') {
                this.rating = 0
            } else {
                return
            }

            this.onDeck.rating = this.rating
            
            // record the response
            try {
                // save important data
                const ratingImageId = this.onDeck.image_id
                const comment = this.comment

                // move on to the next image, and reset comment box
                this.onDeck = this.queue.getNextImage()
                this.comment = ''
                this.commenting = false

                // record important data, this POST is async, but making the
                // request happen after the image swapping after seeing weird
                // hiccups with image loading during development
                api.POST('/hotornot', {
                    id: ratingImageId,
                    rating: this.rating,
                    comment: this.comment,
                    taskId: this.currentTaskId
                })
                
            } catch (error) {
                console.error(error)
            }

        },

        async showAnnotationGuide() {
            
            this.showGuide = true
        },

        // After the image fully transitions out. 
        afterLeave() {
            console.log('after leave')
            // reset img props here
            this.resetImagePos()
            this.transitioningOut = false
        },
        // Before the image starts transitioning out.
        beforeLeave() {
            console.log('before leave')
            this.transitioningOut = true
        }
    }
}

// Helper - Durstenfeld Shuffle
// https://stackoverflow.com/a/12646864/3068136
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = array[i]
        array[i] = array[j]
        array[j] = temp
    }
}
</script>

<style lang='scss' scoped>
.app {
    /* To prevent scrolling */
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding-top: $block-margin;
}

$yes-cancer-color: #5A46B9;
$no-cancer-color: #ff6184;

.bg {
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
    opacity: 0.0;
    transition: opacity 50ms;
    // display: none;


    &.no {
        background-color: lighten($no-cancer-color, 10%);
        opacity: var(--bg-no-opacity);

        // override existing transtion for transitioning image
        &.fade-out {
            transition: opacity var(--img-trans) ease-out;
            opacity: 0;
        }
    }
    
    &.yes {
        background-color: lighten($yes-cancer-color, 10%);
        opacity: var(--bg-yes-opacity);

        // override existing transtion for transitioning image
        &.fade-out {
            transition: opacity var(--img-trans) ease-out;
            opacity: 0;
        }
    }
}

/* Control image size + overlay */
.prompt {
    margin: auto;
    position: relative;
    max-width: 50vh;
    padding-bottom: $block-margin;
    width: 100%;

    @include for-size(mobile) {
        padding: 0 $block-margin 0;
        max-width: 100%;
    }

    .controls {
        color: hsl(0deg, 0%, 29%);
        // width: 100%;

        @include for-size(mobile) {
            padding: 0 0;
        }

        strong {
            padding-top: 0.8rem;
            display: inline-block;
        }
    }
 
}
/* stuck to the bottom of the screen */
.response-area {
    margin: 0 auto;
    width: 100%;
    max-width: 50vh;
    
    display: flex;
    justify-content: center;
    flex-direction: column;

    @include for-size(mobile) {
        padding: 0 $block-margin $block-margin;
        max-width: 100%;
    }

    /* special for extra-small mobile */
    @include for-size(small_mobile) {
        margin: 0 9px;
        max-width: 100%;
    }

    & .swipe-pad {
        width: 100%;
        padding-bottom: 1.25rem;
        display: flex;
        flex-direction: row;
        justify-content: space-between;

        // Don't show the swipe arrows on none touch devices
        // https://stackoverflow.com/a/11387852
        @media (hover: hover) {
            display: none;
        }

        .icon.swipe {
            width: 6.625rem;
            height: 0rem;
            pointer-events: none;
            opacity: 0;

            transition-property: height, opacity;
            transition-duration: 0.25s;
            transition-timing-function: ease-out;
            

            &.left {
                align-self: flex-start;
            }

            &.right {
                align-self: flex-end;
                transform: rotate(180deg);
            }
        }

        &.shown {
            .icon.swipe {
                height: 3.125rem;
                opacity: 0.4;
            }
        }
    }

    .container {
        margin: 0;

        textarea {
            min-height: 0;
            height: 0px;
            opacity: 0;
            // transition: height 0.25s ease-out;
            transition-property: height, opacity;
            transition-duration: 0.25s;
            transition-timing-function: ease-out;
    
            &.shown {
                height: 70px;
                opacity: 1;
            }
        }
    }
}

.icon-button {
    /* centered circle */
    border-radius: 50%;
    margin: 0 auto $button-margin auto;

    &.comment {
        background-color: rgba(0,0,0,0);
    }
}
.grade-buttons {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    flex-wrap: nowrap;
    width: 100%;
    // margin-bottom: 0.75rem;

    .button {
        /* coloration for "yes" and "no" buttons to match grade bars */
        border-color: #00000033;
        padding: 0.75rem 0.875rem;
        width: 5.5rem;

        &.no {
                        /* lighten is a native sass function */
            background-color: lighten($no-cancer-color, 20%);
            &.shown {
                background-color: $no-cancer-color;
            }
        }
        &.yes {
            background-color: lighten($yes-cancer-color, 30%);
            &.shown {
                background-color: $yes-cancer-color;
            }
        }
    }

}

</style>
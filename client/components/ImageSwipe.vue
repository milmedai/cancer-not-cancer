<script>
// the numbers 6 and 12 are aesthetically chosen
const SWIPE_THRESHOLD = 100 // pixels
const Y_TRANSFORM_DIVISOR = 6 // 1/x the rate of the X_transform
const ROTATION_RATE = 12 // for every percent rotate x degrees

export default {
    props: {
        disabled: Boolean
    },
    emits: ['swipeMove', 'swipeEnd'],
    setup(props, { emit }) {
        const swipeEnd = (data) => { emit('swipeEnd', data) }

        // TODO: Simplify useSwipe export and explicitly declare import ie. const { xDistance } = ...
        const swipeData = useSwipe(document, SWIPE_THRESHOLD, swipeEnd)

        const xPercent = computed(() => swipeData.xDistance.value / SWIPE_THRESHOLD)

        const imageContainerStyle = computed(() => {
            const xDiff = swipeData.xDistance.value
            const yDiff = Math.abs(swipeData.xDistance.value)

            const yAmount = yDiff / Y_TRANSFORM_DIVISOR
            // const rotation = percent.value * ROTATION_RATE
            const rotation = xPercent.value * ROTATION_RATE

            return {
                transform: `translate(${xDiff}px, ${yAmount}px) rotate(${rotation}deg)`
            }
        })

        return {
            ...swipeData,
            xPercent,
            imageContainerStyle
        }
    },
    watch: {
        xPercent(percent, oldPercent) {
            this.$emit('swipeMove', percent)
        },
        disabled(isDisabled) {
            if (isDisabled && this.isEnabled) {
                this.toggleEnable()
            } else if (!isDisabled && !this.isEnabled) {
                this.toggleEnable()
            }
        }

    }
}

</script>

<template>
    <div class="image-container" :style="imageContainerStyle">
        <slot />
    </div>
</template>

<style lang="scss" scoped>
.image-container {
    position: relative;
    width: 100%;
    height: 50vh; // If you need padding, don't do it here!
    line-height: 0;
    overflow: hidden;


    // transform: translate(var(--x-diff), calc(var(--y-diff) / -6)) rotate(calc( var(--rot-diff) * -12deg));

    @include for-size(mobile) {
        height: calc(100vw - $block-margin - $block-margin);
    }

}
</style>
/*************************************************************
    * Swipes
    * Modified from https://stackoverflow.com/a/23230280/16755079
    *************************************************************/

export const useSwipe = (target, threshold, onSwipeEnd) => {
    const targetRef = isRef(target) ? target : ref(target)
    
    const startPoint = reactive({ x: 0, y: 0})
    const endPoint = reactive({ x: 0, y: 0})
    
    const xDiff = computed(() => endPoint.x - startPoint.x)
    const yDiff = computed(() => endPoint.y - startPoint.y)

    const isSwipe = ref(false)
    const swipeActive = ref(false)
    const isEnabled = ref(true)

    const toggleEnable = () => { isEnabled.value = !isEnabled.value }

    const thresholdExceeded = computed(() => {
        return (Math.max(Math.abs(xDiff.value), Math.abs(yDiff.value)) >= threshold)
    })

    const direction = computed(() => {
        if (!thresholdExceeded.value) {
            return 'none'
        }

        if (Math.abs(xDiff.value) >= Math.abs(yDiff.value)) {
            return xDiff.value > 0 ? 'right' : 'left'
        } else {
            return yDiff.value > 0 ? 'down' : 'up'
        }
    })


    const getTouchPoint = (evt) => {
        return {
            x: evt.touches[0].clientX,
            y: evt.touches[0].clientY
        }
    }

    const getZeroPoint = (evt) => {
        return {
            x: 0,
            y: 0
        }
    }

    const updateStartPoint = (point) => {
        startPoint.x = point.x
        startPoint.y = point.y
    }

    const updateEndPoint = (point) => {
        endPoint.x = point.x
        endPoint.y = point.y
    }

    const handleTouchStart = (evt) => {
        // skip multitouch
        if (!isEnabled.value || evt.touches.length !== 1) {
            return
        }
        // evt.preventDefault();
        const point = getTouchPoint(evt)
        updateStartPoint(point)
        updateEndPoint(point)
        swipeActive.value = true
    }
    
    const handleTouchMove = (evt) => {
        if (!isEnabled.value || evt.touches.length !== 1) {
            return
        }

        const point = getTouchPoint(evt)
        updateEndPoint(point)
        if (!isSwipe.value && thresholdExceeded.value) {
            isSwipe.value = true
        }
    }

    const handleTouchEnd = (evt) => {
        if (!isEnabled.value) {
            return
        }
        
        if (isSwipe.value && typeof onSwipeEnd === 'function') {
            onSwipeEnd(direction.value)
        }
        isSwipe.value = false

        // reset swipe point
        const point = getZeroPoint(evt)
        updateStartPoint(point)
        updateEndPoint(point)
    }

    const handleTouchCancel = (evt) => {
        isSwipe.value = false
        // reset swipe point
        const point = getZeroPoint(evt)
        updateStartPoint(point)
        updateEndPoint(point)

    }

    // Fixes a firefox swipe conflict. When swiping if the reload page
    // swipe starts to engage, other animations freeze and hang. The
    // following line deactivates swiping to reload page.
    targetRef.value.documentElement.style.setProperty('--overscroll', 'none')
    // Turn scrolling off
    targetRef.value.documentElement.style.setProperty('--overflow', 'hidden')

    // Required for touches
    targetRef.value.addEventListener('touchstart', handleTouchStart, false)
    targetRef.value.addEventListener('touchmove', handleTouchMove, false)
    targetRef.value.addEventListener('touchend', handleTouchEnd, false)
    targetRef.value.addEventListener('touchcancel', handleTouchCancel, false)

    onUnmounted(() => {
        // Reactivates swipe to reload (deactivated in the mount method)
        targetRef.value.documentElement.style.setProperty('--overscroll', 'auto')
        // Allowing scrolling
        targetRef.value.documentElement.style.setProperty('--overflow', 'initial')

        // We need to cleanup our event listeners. So we don't have duplicates when we return.
        targetRef.value.removeEventListener('touchstart', handleTouchStart, false)
        targetRef.value.removeEventListener('touchmove', handleTouchMove, false)
        targetRef.value.removeEventListener('touchend', handleTouchEnd, false)
        targetRef.value.removeEventListener('touchcancel', handleTouchCancel, false)
    })

    return {
        xDistance: xDiff,
        yDistance: yDiff,
        direction,
        isSwipe,
        isEnabled,
        toggleEnable
    }

}
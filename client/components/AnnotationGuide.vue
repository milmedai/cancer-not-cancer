<script setup>
const api = useApi()

const { taskId } = defineProps(['taskId'])

const emit = defineEmits(['exit'])

const HTMLcontent = ref('No guide was found for this task.')

if (taskId) {
    const { response } = await api.GET(`/tasks/${taskId}/guide`)
    HTMLcontent.value = response.value || "<p>No guide provided.</p>"
}

const exit = () => {
    emit('exit')
}

// watch(selectedTask, async (newTask, oldTask) => {
//     emit('taskSelected', newTask)
// })
</script>

<template>
    <div class="modal is-active on-top-nav">
        <div class="modal-background" @click="exit"></div>
        <div class="modal-content max-height-100">
            <div class="section">
                <div class="notification">
                    <button class="delete" @click="exit"></button>
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div class="title is-5">
                                    Annotation Guide
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="content" v-html="HTMLcontent"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.max-height-100 {
    max-height: 100%;
}
</style>
// Using the composable api
<script setup>
const dataTools = useDataTools()
const { task } = defineProps(['task'])
const emit = defineEmits(['done'])

const getJSON = () => {
    const fileName = `${task.short_name.replaceAll(' ', '_')}_data.json`
    dataTools.downloadTaskAsJSON(task, fileName)

    emit('done')
}

const getCSV = () => {
    const fileName = `${task.short_name.replaceAll(' ', '_')}_data.csv`
    dataTools.downloadTaskAsCSV(task, fileName)

    emit('done')
}

</script>

<template>
    <div class="modal" v-bind:class="{ 'is-active': true }">
        <div class="modal-background" @click="emit('done')"></div>
        <div class="modal-content">
            <div class="section">
                <div class="box p-5 smooth-height">
                    <div class="field">
                        <label class="label">Export Data</label>
                        <p>
                            Saving the image rating data for the task named <strong>{{ task.short_name }}</strong>.
                            <br />
                            You can choose to download it as JSON or as a CSV format.
                        </p>
                    </div>
                    <div class="field is-grouped">
                        <p class="control">
                            <button class="button is-info" @click="getJSON">JSON</button>
                        </p>
                        <p class="control">
                            <button class="button is-success" @click="getCSV">CSV</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>


<style lang='scss' scoped>
</style>
<template>
    <div>
        <!-- Main tasks -->
        <section class='section tasks-controller'>
            <h1 class='title'>Tasks</h1>
            <div class="pb-2">
                <form @submit.prevent='createTask()'>
                    <div class="field is-horizontal">
                        <div class="field-label is-normal">
                            <label class="label">Create New Task</label>
                        </div>
                        <div class="field-body">
                            <div class="field is-grouped">
                            <p class="control has-icons-left">
                                <input class="input" type="text" :maxlength="100" placeholder="name" v-model="task.name">
                                <span class="icon is-small is-left">
                                <fa-icon :icon="['fas', 'tag']" />
                                </span>
                            </p>
                            <p class="control is-expanded has-icons-left has-icons-right">
                                <input class="input" type="text" placeholder="Prompt" v-model="task.prompt" />
                                <span class="icon is-small is-left">
                                <fa-icon :icon="['fas', 'question']" />
                                </span>
                            </p>
                            <p class="control">
                                <input class='button is-success' type="submit" value="Create" />
                            </p>
                            </div>
                        </div>
                    </div>
                    <div class="field is-horizontal">
                        <div class="field-label is-normal">
                            <p class="help is-size-6">After creating a new task be sure to edit the task in the table below to add observers and images.</p>
                        </div>
                    </div>
                </form>
            </div>
            <div class="py-2">
                <div class='box'>
                    <h3>Existing Tasks</h3>
                    <table class="table is-striped is-narrow is-fullwidth is-hoverable">
                        <thead>
                            <th v-for="colName in columns">{{ colName }}</th>
                        </thead>
                        <tbody>

                            <Row v-for="row in taskData" :key="row[indexProp]" :class="{ 'is-selected': false }"  :row="row" :order="order" @edit="editTask" @delete="deleteTask" @export="exportTask" />
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
        <!-- Edit Task -->
        <TaskEdit v-if="taskToEdit != null" :task="taskToEdit" @save="finishTaskEdit" @cancel="taskToEdit = null"/>
        <Export v-if="exportData != null" :task="exportData" @done="exportData=null" />
    </div>
</template>

<script>
const api = useApi()

export default {
    data() {
        return {
            task: {
                name: null,
                prompt: null,
            },
            columns: ['Name', 'Prompt', 'Images', 'Observers', 'Progress', 'Actions'],
            order: ['short_name', 'prompt', 'image_count', 'observer_count', 'progress', 'action'],
            indexProp: 'id',
            taskData: [],
            taskToEdit: null,
            exportData: null,
        }
    },
    computed: {
    },
    watch: {
    },
    created() {
        this.getTasksTable()
    },

    methods: {
        async createTask() {
            try {
                const { response } = await api.POST('/tasks/', {
                    short_name: this.task.name,
                    prompt: this.task.prompt,
                })
                this.taskData.push({
                    id: response.value.newTaskId,
                    short_name: this.task.name,
                    prompt: this.task.prompt,
                    chip_size: null,
                    fov_size: null,
                    zoom_scale: null,
                    image_count: 0,
                    observer_count: 0,
                    progress: 0
                })
                this.task.name = null
                this.task.prompt = null
            } catch (err) {
                console.log(err)
            }
        },
        editTask(task) {
            this.taskToEdit = task
        },
        finishTaskEdit(auxData, close = true) {
            const index = this.taskData.findIndex(task => task.id == this.taskToEdit.id)
            if (auxData.observers !== null)
                this.taskData[index].observer_count = auxData.observers
            if (auxData.images !== null)
                this.taskData[index].image_count = auxData.images
            this.updateTaskProgress(index)
            if (close) {
                this.taskToEdit = null
            }
        },
        async deleteTask(task) {
            try {
                await api.POST('/tasks/delete', {
                    id: task.id
                })
                const index = this.taskData.findIndex(curTask => curTask.id === task.id)
                this.taskData.splice(index, 1)
            } catch (err) {
                console.log(err)
            }
        },
        exportTask(task) {
            console.log(`Export Task ${task.id}`)
            this.exportData = task
        },
        async getTasksTable() {
            try {
                const { response } = await api.GET('/tasks/table')
                this.taskData = response.value
            } catch (err) {
                console.error(err);
            }
        },
        async updateTaskProgress(taskIndex) {
            try {
                const { response } = await api.GET('/tasks/progress', {
                    task_id: this.taskData[taskIndex].id
                })
                const progress = response.value.progress
                this.taskData[taskIndex].progress = progress ? progress : 0
            } catch (err) {
                console.log(err)
            }
        }

    }
}
</script>

<style lang='scss'>

section.tasks-controller {
    padding-top: 0;
}

input:focus + span {
    color: hsl(0, 0%, 4%);
}

</style>
<template>
    <div class="modal" v-bind:class="{ 'is-active': true }">
        <div class="modal-background" @click="cancelChanges"></div>
        <div class="modal-content">
            <div class="section">
                <div class="box p-5">
                    <!-- Name and Prompt update fields -->
                    <div class="field">
                        <label class="label">Name</label>
                        <div class="control is-medium">
                            <input class="input is-medium has-text-weight-bold" type="text" v-model="localTask.short_name">
                        </div>
                    </div>
                    <div class="field">
                        <label class="label">Prompt</label>
                        <div class="control is-medium">
                            <textarea class="textarea has-text-weight-medium prompt" v-model="localTask.prompt" />
                        </div>
                    </div>

                    <!-- Tab navigation -->
                    <div class="task-edit-nav tabs is-boxed">
                        <ul>
                            <li v-for="tab in tabs"
                                :key="tab.name"
                                :class="{ 'is-active': activeTab === tab.name }"
                                @click="activeTab = tab.name">
                                <a>{{ tab.label }}</a>
                            </li>
                        </ul>
                    </div>
                
                    <!-- Tab contents for editing the task -->
                    <div class="field">
                        <template v-for="tab in tabs">
                            <component
                                :is="tab.component"
                                :key="tab.name"
                                v-if="activeTab === tab.name"
                                v-bind="tab.props"
                                v-on="tab.events"
                            />
                        </template>
                    </div>

                    <!-- Save Controls -->
                    <div class="field is-grouped">
                        <p class="control">
                            <button class="button is-warning" @click="cancelChanges">Cancel</button>
                        </p>
                        <p class="control">
                            <button class="button is-success" @click="saveChanges">Save</button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
const api = useApi()
const fileTools = useFileTools()
const Adder = resolveComponent('Adder')
const ImagePicker = resolveComponent('ImagePicker')
const RoiSettings = resolveComponent('RoiSettings')
const ContentEditor = resolveComponent('ContentEditor')

export default {
    props: ['task'],
    emits: ['save', 'cancel'],
    data() {
        return {
            activeTab: 'observers',
            localTask: Object.assign({}, this.task),
            observers: {
                applied: [],
                available: [],
            },
            root: {
                id: 0,
                name: 'root',
                contents: [],
                type: 'tag',
                selected: [],
            },
            annotationGuide: ''
        }
    },
    computed: {
        tabs() {
            const chipSize = this.localTask.chip_size
            const fovSize = this.localTask.fov_size
            const zoomScale = this.localTask.zoom_scale
            return [
                {
                    name: 'observers',
                    label: "Observers",
                    component: Adder,
                    props: { tags: this.observers },
                    events: { update: this.updateObservers }
                },
                {
                    name: 'images',
                    label: "Images",
                    component: ImagePicker,
                    props: { files: this.root.contents },
                    events: { report: this.report }

                },
                {
                    name: 'roi',
                    label: "ROI",
                    component: RoiSettings,
                    props: { chipSize, fovSize, zoomScale },
                    events: { update: this.updateRoi }

                },
                {
                    name: 'guide',
                    label: "Annotation Guide",
                    component: ContentEditor,
                    props: { initialContent: this.annotationGuide },
                    events: { update: this.updateGuide }

                }
            ]
        }
    },
    async mounted() {
        try {
            const [observersData, imagesData, guideData] = await Promise.all([
                api.GET('/tasks/observers', {
                    task_id: this.task.id
                }),
                api.GET('/tasks/images', {
                    task_id: this.task.id
                }),
                api.GET(`/tasks/${this.task.id}/guide`)
            ])
            const observers = observersData.response.value
            const images = imagesData.response.value
            const guideContent = guideData.response.value

            for (const user of observers) {
                if (user.applied) {
                    this.observers.applied.push(user)
                } else {
                    this.observers.available.push(user)
                }
            }
            
            // TODO: this can be done above
            this.root.contents = images
            this.annotationGuide = guideContent
        } catch (error) {
            console.error(error)
        }
    },
    methods: {
        async saveChanges() {
            try {
                const selectedImages = fileTools.getSelectedFiles(this.root)

                const results = await Promise.allSettled([
                    api.POST('/tasks/update', {
                        id: this.localTask.id,
                        short_name: this.localTask.short_name,
                        prompt: this.localTask.prompt,
                        chip_size: this.localTask.chip_size,
                        fov_size: this.localTask.fov_size,
                        zoom_scale: this.localTask.zoom_scale,
                    }),
                    api.POST('/tasks/observers', {
                        task_id: this.localTask.id,
                        observerIds: JSON.stringify(this.observers.applied.map(user => user.id)),
                    }),
                    api.POST('/tasks/images', {
                        task_id: this.localTask.id,
                        imageIds: JSON.stringify(selectedImages),
                    }),
                    api.POST(`/tasks/${this.localTask.id}/guide`, {
                        content: this.annotationGuide
                    })
                ])
                // TODO: clean up results logic
                if (results[0].status === "fulfilled") {
                    this.task.short_name = this.localTask.short_name
                    this.task.prompt = this.localTask.prompt
                    this.task.chip_size = this.localTask.chip_size
                    this.task.fov_size = this.localTask.fov_size
                    this.task.zoom_scale = this.localTask.zoom_scale
                } else {
                    console.error("There was an error saving the task data.")
                }

                const closeIfNoErrors = results.every((res) => (res.status === "fulfilled"))

                // Emit save event to update stats in task table.
                this.$emit('save', {
                    observers: results[1].status === "fulfilled" ? this.observers.applied.length : null,
                    images: results[2].status === "fulfilled" ? selectedImages.length : null
                }, closeIfNoErrors)

                if (!closeIfNoErrors) {
                    // TODO: turn this into a notification
                    console.warn("Not all content was saved. To preserve current unsaved changes, the task editor has not been closed.")
                }

            } catch (err) {
                console.error(err)
            }
        },
        cancelChanges() {
            console.log('changes cancelled')
            this.$emit('cancel')
        },
        updateObservers(observersData) {
            this.observers.applied = observersData.applied
            this.observers.available = observersData.available
        },
        updateRoi(roiData){
            this.localTask.chip_size = roiData.chipSize
            this.localTask.fov_size = roiData.fovSize
            this.localTask.zoom_scale = roiData.zoomScale
        },
        updateGuide(guideContent) {
            this.annotationGuide = guideContent
        },
        report() {
            console.log('Files selected')
            console.log(fileTools.getSelectedFiles(this.root))
        }
    }
}

</script>


<style lang='scss' scoped>
.prompt {
    min-height: 3.5rem;
}
.task-edit-nav.tabs {
    
    li {
        a {
            color: $primary;
        }

        &.is-active {
            a {
                color: $info;
                font-weight: bold;
                border-bottom-color: $info;
            }
        }

    }
}

.smooth-height {
    transition: max-height 0.5s ease;
    max-height: 100vh;
}

.tab-enter-active, .tab-leave-active {
    transition: max-height 0.5s ease;
    overflow: hidden;
}

.tab-enter-from, .tab-leave-to {
    max-height: 0;
    overflow: hidden;
}
</style>